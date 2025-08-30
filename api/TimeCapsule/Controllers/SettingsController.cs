using System.ComponentModel;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using SqlSugar;
using SqlSugar.IOC;
using TimeCapsule.Core.Models.Db;
using TimeCapsule.Models.Options;

namespace TimeCapsule.Controllers;

/// <summary>
/// 设置项控制器
/// </summary>
[ApiController]
[DisplayName("设置项")]
[Route("[controller]/[action]")]
public class SettingsController : ControllerBase
{
    /// <summary>
    /// DbClient
    /// </summary>
    private ISqlSugarClient Db { get; } = DbScoped.SugarScope;

    private readonly SystemOptions _systemOptions;

    /// <summary>
    /// 构造函数
    /// </summary>
    /// <param name="systemOptions"></param>
    public SettingsController(IOptions<SystemOptions> systemOptions)
    {
        _systemOptions = systemOptions.Value;
    }

    /// <summary>
    /// 获取存储占用信息(MB)
    /// </summary>
    /// <param name="path">cache / detection</param>
    /// <returns></returns>
    [HttpGet]
    public async Task<ActionResult<Dictionary<string, decimal>>> GetStorageInfo(string path)
    {
        var dir = path.ToLower() switch
        {
            "cache" => _systemOptions.CachePath,
            "detection" => _systemOptions.DetectionPath,
            _ => string.Empty
        };
        if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir)) return BadRequest("Invalid path");
        // 获取所有摄像头
        var cameras = await Db.Queryable<Camera>().ToListAsync();
        // 获取各个摄像头的文件夹
        var cameraDirs = Directory.GetDirectories(dir);
        var result = new Dictionary<string, decimal>();
        foreach (var cameraDir in cameraDirs)
        {
            if (!long.TryParse(Path.GetFileNameWithoutExtension(cameraDir), out var id)) continue;
            var camera = cameras.FirstOrDefault(x => x.Id == id);
            if (camera == null) continue;
            // 计算文件夹大小，单位MB
            var size = Directory.GetFiles(cameraDir, "*", SearchOption.AllDirectories)
                .Sum(f => new FileInfo(f).Length) / 1024m / 1024m;
            result[camera.Name] = Math.Round(size, 2);
        }

        return Ok(result);
    }
}