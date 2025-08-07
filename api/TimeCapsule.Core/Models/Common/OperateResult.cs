namespace TimeCapsule.Core.Models.Common;

/// <summary>
/// 操作结果
/// </summary>
/// <param name="IsSuccess">操作结果</param>
/// <param name="Message">消息</param>
/// <param name="OperateException">操作异常</param>
public record OperateResult(bool IsSuccess, string Message, Exception? OperateException = null)
{
    /// <summary>
    /// 操作成功
    /// </summary>
    /// <param name="message">消息</param>
    /// <returns></returns>
    public static OperateResult Success(string message = "") => new(true, message);

    /// <summary>
    /// 操作失败
    /// </summary>
    /// <param name="message">消息</param>
    /// <param name="exception">异常</param>
    /// <returns></returns>
    public static OperateResult Fail(string message = "", Exception? exception = null) =>
        new(false, message, exception);

    /// <summary>
    /// 尝试执行操作
    /// </summary>
    /// <param name="action">待执行操作</param>
    /// <returns></returns>
    public static OperateResult Execute(Action action)
    {
        try
        {
            action();
            return Success();
        }
        catch (Exception ex)
        {
            return Fail(ex.Message, ex);
        }
    }
}

/// <summary>
/// 操作结果
/// </summary>
/// <param name="IsSuccess">操作成功</param>
/// <param name="Message">消息</param>
/// <param name="Content">操作结果</param>
/// <param name="OperateException">异常</param>
/// <typeparam name="T">操作结果类型</typeparam>
public record OperateResult<T>(bool IsSuccess, string Message, T? Content = default, Exception? OperateException = null)
    : OperateResult(IsSuccess, Message, OperateException)
{
    /// <summary>
    /// 操作成功
    /// </summary>
    /// <param name="content">内容</param>
    /// <param name="message">消息</param>
    /// <returns></returns>
    public static OperateResult<T> Success(T content, string message = "") => new(true, message, content);

    /// <summary>
    /// 操作失败
    /// </summary>
    /// <param name="message">消息</param>
    /// <param name="exception">异常</param>
    /// <returns></returns>
    public new static OperateResult<T> Fail(string message = "", Exception? exception = null) =>
        new(false, message, OperateException: exception);

    /// <summary>
    /// 尝试执行操作
    /// </summary>
    /// <param name="func">待执行操作</param>
    /// <returns></returns>
    public static OperateResult<T> Execute(Func<T> func)
    {
        try
        {
            return Success(func());
        }
        catch (Exception ex)
        {
            return Fail(ex.Message, ex);
        }
    }
}