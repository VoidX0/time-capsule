using TimeCapsule;
using TimeCapsule.Core.Utils.Extension;
using TimeCapsule.Services;
using TimeCapsule.Utils.Extension;
using TimeCapsule.Utils.Middleware;

var builder = WebApplication.CreateBuilder(args);

builder.InitConfiguration(); // 初始化配置源
// Add services to the container.
builder.Services.AddControllers(x => { x.Filters.Add<ApiAuthorizationFilter>(); })
    .AddJsonOptions(options => options.JsonSerializerOptions.ConfigureOptions()); // Controller
builder.Services.AddEndpointsApiExplorer();
builder.InitOptions(); // 初始化Options
builder.InitEncryption(); // 初始化加密信息
builder.InitStorage(); // 初始化Storage
builder.ConfigureLog(); // 配置日志
builder.ConfigureSerilogUi(); // 配置SerilogUI
builder.ConfigureApiReference(); // 配置API文档
builder.ConfigureHangfire(); // 配置Hangfire
builder.ConfigureJwt(); // 配置Jwt
builder.ConfigureDb(); // 配置数据库
builder.Services.AddSingleton<VideoService>(); // 视频服务
builder.Services.AddSingleton<ScheduledJob>(); // 定时任务

// 构建App
var app = builder.Build();
App.Application = app; // 全局App
await app.FfmpegInit(); // ffmpeg初始化
app.ApiLogs(); // 启用API日志
app.ApiReference(); // 启用API参考
app.ApiHangfire(); // 启用Hangfire仪表盘
app.Serilog(); // 启用Serilog请求日志

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Services.GetService<ScheduledJob>(); // 启动定时任务
// 启动App
app.Run();

namespace TimeCapsule
{
    /// <summary>
    /// 全局App
    /// </summary>
    public static class App
    {
        private static WebApplication? _application;

        /// <summary>
        /// WebApplication
        /// </summary>
        public static WebApplication? Application
        {
            get => _application;
            set
            {
                _application = value;
                Services = value?.Services;
            }
        }

        /// <summary>
        /// ServiceProvider
        /// </summary>
        public static IServiceProvider? Services { get; private set; }
    }
}