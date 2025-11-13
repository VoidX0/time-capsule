using System.ComponentModel;
using System.Reflection;
using System.Text;
using Hangfire;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration.Json;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Serilog;
using Serilog.Events;
using Serilog.Sinks.Grafana.Loki;
using Serilog.Ui.Core.Extensions;
using Serilog.Ui.SqliteDataProvider.Extensions;
using Serilog.Ui.Web.Extensions;
using SqlSugar;
using SqlSugar.IOC;
using TimeCapsule.Controllers;
using TimeCapsule.Core.Models.Db;
using TimeCapsule.Core.Utils.Extension;
using TimeCapsule.Core.Utils.Security;
using TimeCapsule.Models.Options;
using Tomlyn.Extensions.Configuration;

namespace TimeCapsule.Utils.Extension;

/// <summary>
/// WebApplicationBuilder扩展
/// </summary>
public static class WebApplicationBuilderExtension
{
    /// <summary>
    /// 缓存配置
    /// </summary>
    private static readonly Dictionary<string, object> Configurations = new();

    /// <summary>
    /// 获取配置
    /// </summary>
    /// <param name="builder"></param>
    /// <typeparam name="T"></typeparam>
    /// <returns></returns>
    private static T GetConfiguration<T>(this WebApplicationBuilder builder) where T : class, new()
    {
        // 优先从缓存中获取
        if (Configurations.TryGetValue(typeof(T).Name, out var config)) return (T)config;
        // 从配置中获取
        var configuration = builder.Configuration.GetSection(typeof(T).Name).Get<T>() ?? new T();
        // 添加到缓存
        Configurations.Add(typeof(T).Name, configuration);
        return configuration;
    }

    /// <summary>
    /// 初始化配置源
    /// 优先级：环境变量 > 当前环境配置 > 默认配置
    /// </summary>
    /// <param name="builder"></param>
    public static void InitConfiguration(this WebApplicationBuilder builder)
    {
        // 移除Json配置源
        var source = builder.Configuration.Sources;
        for (var i = 0; i < source.Count; i++)
        {
            if (source[i] is not JsonConfigurationSource) continue;
            source.RemoveAt(i);
            i--;
        }

        // 添加配置源
        builder.Configuration
            .AddTomlFile("appsettings.toml", optional: true, reloadOnChange: true) // 默认配置
            .AddTomlFile("appsettings.Development.toml", optional: true, reloadOnChange: true) // 当前环境配置
            .AddEnvironmentVariables(); // 环境变量
    }

    /// <summary>
    /// 初始化Options
    /// </summary>
    /// <param name="builder"></param>
    public static void InitOptions(this WebApplicationBuilder builder)
    {
        builder.Services.Configure<SystemOptions>(builder.Configuration.GetSection(nameof(SystemOptions)));
        builder.Services.Configure<TokenOptions>(builder.Configuration.GetSection(nameof(TokenOptions)));
        builder.Services.Configure<OidcOptions>(builder.Configuration.GetSection(nameof(OidcOptions)));
        builder.Services.Configure<ConnectionOptions>(builder.Configuration.GetSection(nameof(ConnectionOptions)));
        builder.Services.Configure<SmtpOptions>(builder.Configuration.GetSection(nameof(SmtpOptions)));
    }

    /// <summary>
    /// 初始化加密信息
    /// </summary>
    /// <param name="builder"></param>
    public static void InitEncryption(this WebApplicationBuilder builder)
    {
        var token = builder.GetConfiguration<TokenOptions>();
        // AES
        if (!string.IsNullOrWhiteSpace(token.AesKey) && !string.IsNullOrWhiteSpace(token.AesIv))
            SecurityAes.InitAesByKey(token.AesKey, token.AesIv);
        // RSA(动态生成)
    }

    /// <summary>
    /// 初始化Storage
    /// </summary>
    /// <param name="builder"></param>
    public static void InitStorage(this WebApplicationBuilder builder)
    {
        var system = builder.GetConfiguration<SystemOptions>();
        var storage = new DirectoryInfo(Path.Combine(system.StoragePath));
        if (!storage.Exists) storage.Create();
    }

    /// <summary>
    /// 配置日志
    /// </summary>
    /// <param name="builder"></param>
    public static void ConfigureLog(this WebApplicationBuilder builder)
    {
        var system = builder.GetConfiguration<SystemOptions>();
        var connection = builder.GetConfiguration<ConnectionOptions>();
        var logPath = new DirectoryInfo(Path.Combine(system.StoragePath, "Logs"));
        if (!logPath.Exists) logPath.Create();
        // 日志输出设置
        var configuration = new LoggerConfiguration()
            .Filter.ByExcluding(x =>
                x.RenderMessage().Contains("/scalar/") || x.RenderMessage().Contains("/openapi/")) //排除的日志
            .MinimumLevel.Debug() //最低日志级别
            .MinimumLevel.Override("Microsoft", LogEventLevel.Warning) //覆盖日志级别
            .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning) //覆盖日志级别
            .MinimumLevel.Override("Microsoft.Hosting.Lifetime", LogEventLevel.Warning) //覆盖日志级别
            .MinimumLevel.Override("Hangfire", LogEventLevel.Information) //覆盖日志级别
            .Enrich.FromLogContext() //添加上下文
            .Enrich.With(new ContextEnricher()) // 转换上下文
            // 控制台日志
            .WriteTo.Console(theme: SerilogTheme.CustomConsole,
                outputTemplate:
                "[{Timestamp:HH:mm:ss.fff}] [{Level:u3}] [{SourceContext:l}] {Message:lj}{NewLine}{Exception}") //控制台日志
            // Sqlite日志
            .WriteTo.SQLite(Path.Combine(logPath.FullName, "logs.db"),
                storeTimestampInUtc: true, // 以UTC时间存储
                retentionPeriod: TimeSpan.FromDays(30), //保留30天
                maxDatabaseSize: 100 //数据库文件最大100MB
            );
        // Loki日志
        if (!string.IsNullOrWhiteSpace(connection.LogServer))
            configuration = configuration
                .WriteTo.GrafanaLoki(connection.LogServer, [
                        new LokiLabel
                        {
                            Key = "app",
                            Value = builder.Environment.ApplicationName
                        },
                        new LokiLabel
                        {
                            Key = "instance",
                            Value = system.Instance ?? ""
                        }
                    ], ["level", "SourceContext"],
                    restrictedToMinimumLevel: LogEventLevel.Information); //最低日志级别(Loki)
        // 创建Logger
        Log.Logger = configuration.CreateLogger();
        builder.Host.UseSerilog(); //使用Serilog
        Log.ForContext<Program>().Information("Logger initialized, app: {ApplicationName}, instance: {Instance}",
            builder.Environment.ApplicationName, system.Instance);
    }

    /// <summary>
    /// 配置SerilogUI
    /// </summary>
    /// <param name="builder"></param>
    public static void ConfigureSerilogUi(this WebApplicationBuilder builder)
    {
        var system = builder.GetConfiguration<SystemOptions>();
        var db = Path.Combine(system.StoragePath, "Logs", "logs.db");
        builder.Services.AddSerilogUi(x => x
                .UseSqliteServer(y => y
                    .WithConnectionString($"Data Source={db};")
                    .WithSchema("main")
                    .WithTable("Logs")
                )
                .AddScopedBasicAuthFilter() //添加基本认证
        );
    }

    /// <summary>
    /// 配置API文档
    /// </summary>
    /// <param name="builder"></param>
    public static void ConfigureApiReference(this WebApplicationBuilder builder)
    {
        var app = builder.Environment.ApplicationName;
        var version = Assembly.GetEntryAssembly()?.GetName().Version;
        builder.Services.AddSwaggerGen(x =>
        {
            // 添加版本
            x.SwaggerDoc("v1", new OpenApiInfo { Title = app, Version = version?.ToString() });
            // 添加注释
            var basePath = Path.GetDirectoryName(typeof(Program).Assembly.Location) ?? "";
            var xmlPath = Path.Combine(basePath, $"{app}.xml");
            x.IncludeXmlComments(xmlPath);
            // 添加描述
            x.SchemaFilter<EnumDescriptionFilter>();
            x.SchemaFilter<SugarTableDescriptionFilter>();
            x.SchemaFilter<SugarColumnDescriptionFilter>();
            // 添加文档
            x.DocumentFilter<MarkdownDocumentFilter>();
            // 添加授权
            x.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                In = ParameterLocation.Header,
                Name = "Authorization",
                Type = SecuritySchemeType.ApiKey,
            });
        });
    }

    /// <summary>
    /// 配置Hangfire
    /// </summary>
    /// <param name="builder"></param>
    public static void ConfigureHangfire(this WebApplicationBuilder builder)
    {
        builder.Services.AddHangfire(configuration => configuration
            .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
            .UseSimpleAssemblyNameTypeSerializer()
            .UseRecommendedSerializerSettings()
            .UseInMemoryStorage());
        builder.Services.AddHangfireServer();
    }

    /// <summary>
    /// 配置Jwt
    /// </summary>
    /// <param name="builder"></param>
    public static void ConfigureJwt(this WebApplicationBuilder builder)
    {
        var token = builder.GetConfiguration<TokenOptions>();
        builder.Services.AddAuthentication(x =>
        {
            x.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            x.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        }).AddJwtBearer(x =>
        {
            x.RequireHttpsMetadata = false;
            x.SaveToken = true;
            x.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(token.Secret)),
                //验证发布者
                ValidateIssuer = false,
                ValidIssuer = token.Issuer,
                //验证订阅者
                ValidateAudience = false,
                ValidAudience = token.Audience
            };
        });
    }

    /// <summary>
    /// 配置数据库
    /// </summary>
    /// <param name="builder"></param>
    public static void ConfigureDb(this WebApplicationBuilder builder)
    {
        var system = builder.GetConfiguration<SystemOptions>();
        var logger = Log.ForContext<Program>();
        //设置雪花ID
        SnowFlakeSingle.DatacenterId = SqlSugarExtension.GetDataCenterId(system.Instance ?? "");
        SnowFlakeSingle.WorkId = SqlSugarExtension.GetWorkId(system.Instance ?? "");
        logger.Information("DatacenterId: {DatacenterId}, WorkId: {WorkId}",
            SnowFlakeSingle.DatacenterId, SnowFlakeSingle.WorkId);
        //数据库配置
        var connection = builder.GetConfiguration<ConnectionOptions>();
        SugarIocServices.AddSqlSugar(new IocConfig
        {
            ConnectionString = connection.DbConnection,
            IsAutoCloseConnection = true,
            DbType = IocDbType.PostgreSQL
        });
        //配置参数
        SugarIocServices.ConfigurationSugar(client =>
        {
            client.CurrentConnectionConfig.ConfigureExternalServices = new ConfigureExternalServices
            {
                EntityService = (property, column) =>
                {
                    // isNullable=true处理
                    if (property.PropertyType.IsGenericType &&
                        property.PropertyType.GetGenericTypeDefinition() == typeof(Nullable<>))
                        column.IsNullable = true;
                    //处理列名 驼峰转下划线
                    column.DbColumnName = UtilMethods.ToUnderLine(column.DbColumnName);
                },
                EntityNameService = (_, entity) =>
                    entity.DbTableName = UtilMethods.ToUnderLine(entity.DbTableName) //处理表名 驼峰转下划线
            };
            // client.Aop.OnLogExecuting = (sql, parameters) =>
            // {
            //     // 打印SQL，用于调试
            //     logger.Debug(UtilMethods.GetNativeSql(sql, parameters));
            // };
        });

        //操作回调
        var succeedAction = new Action<string>(info => logger.Information(info));
        var failAction = new Action<Exception, string>((exception, info) =>
        {
            logger.Fatal(exception, $"{info}, the program will stop running");
            Thread.Sleep(3000);
            Environment.Exit(-1);
        });
        //初始化数据库
        DbScoped.SugarScope.InitDb(succeedAction, failAction);
        //初始化系统信息
        var controllers = typeof(SettingsController).Assembly.GetTypes()
            .Where(x => x is { IsPublic: true, IsClass: true, IsAbstract: false }
                        && x.Namespace?.StartsWith(typeof(SettingsController).Namespace ?? "unknown namespace") ==
                        true) //命名空间过滤
            .Where(x => x.GetCustomAttributes(typeof(DisplayNameAttribute), false).Length > 0)
            .Select(x => new SystemController
            {
                Controller = x.Name,
                Title = ((DisplayNameAttribute)x.GetCustomAttributes(typeof(DisplayNameAttribute), false)[0])
                    .DisplayName
            }).ToList();
        DbScoped.SugarScope.InitSystem(system.DefaultUser, system.DefaultPassword, controllers,
            succeedAction, failAction);
    }
}
