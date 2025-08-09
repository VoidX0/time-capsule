namespace TimeCapsule.Core.Utils;

/// <summary>
/// 动态赋值
/// </summary>
public static class DynamicAssignment
{
    /// <summary>
    /// 使用已有实例创建或修改指定类型新实例
    /// </summary>
    /// <param name="source">源实例</param>
    /// <param name="result">新实例</param>
    /// <typeparam name="TS">源实例类型</typeparam>
    /// <typeparam name="TR">指定类型</typeparam>
    /// <returns>指定类型新实例 / null</returns>
    public static TR? Assignment<TS, TR>(TS source, TR? result = null)
        where TS : class
        where TR : class, new()
    {
        //新建实例
        result ??= new TR();
        //记录实例属性名称及属性值
        var resultProps = result.GetType().GetProperties();
        var resultNames = resultProps.Select(x => x.Name).ToList();
        var resultValues = resultProps.Select(x => x.GetValue(result)).ToList();
        //获取属性错误
        if (resultNames.Count != resultValues.Count) return default;

        //遍历源实例属性
        foreach (var prop in source.GetType().GetProperties())
        {
            var index = resultNames.IndexOf(prop.Name);
            if (index == -1) continue;
            //尝试赋值
            try
            {
                resultProps[index].SetValue(result, prop.GetValue(source), null);
            }
            catch
            {
                // ignored
            }
        }

        return result;
    }
}