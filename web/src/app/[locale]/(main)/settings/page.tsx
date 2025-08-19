'use client'

import { components } from '@/api/schema'
import CameraChart from '@/components/camera/camera-chart'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { openapi } from '@/lib/http'
import { rsaEncrypt } from '@/lib/security'
import { Check, Pen, Shield, ShieldPlus, ShieldX, UserRoundPen, UserRoundPlus, UserRoundX } from 'lucide-react'
import { useEffect, useState } from 'react'

type Role = components['schemas']['SystemRole']
type User = components['schemas']['SystemUser']
type SystemController = components['schemas']['SystemController']

export default function Page() {
  const [roles, setRoles] = useState<Role[]>([]) // 所有角色列表
  const [users, setUsers] = useState<User[]>([]) // 所有用户列表
  const [roleDialogOpen, setRoleDialogOpen] = useState(false) // 角色弹窗状态
  const [editRole, setEditRole] = useState<Role | null>(null) // 正在编辑的角色
  const [userDialogOpen, setUserDialogOpen] = useState(false) // 用户弹窗状态
  const [editUser, setEditUser] = useState<User | null>(null) // 正在编辑的用户
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]) // 选中的角色列表

  const [authorizeDialogOpen, setAuthorizeDialogOpen] = useState(false) // 授权弹窗状态
  const [authorizeType, setAuthorizeType] = useState<'user' | 'role' | null>(
    null,
  ) // 授权类型（用户或角色）
  const [authorizeTarget, setAuthorizeTarget] = useState<User | Role | null>(
    null,
  ) // 授权目标（用户或角色）
  const [grantedControllers, setGrantedControllers] = useState<
    SystemController[]
  >([]) // 已授权的控制器列表
  const [unGrantedControllers, setUnGrantedControllers] = useState<
    SystemController[]
  >([]) // 未授权的控制器列表
  const [initialGrantedIds, setInitialGrantedIds] = useState<number[]>([])
  const [grantedCheckedIds, setGrantedCheckedIds] = useState<number[]>([]) // 已授权列表，当前勾选
  const [unGrantedCheckedIds, setUnGrantedCheckedIds] = useState<number[]>([]) // 未授权列表，当前勾选

  /* 刷新数据 */
  const refresh = async () => {
    const { data: rolesData } = await openapi.GET('/Authentication/Roles')
    setRoles(rolesData ?? [])
    const { data: usersData } = await openapi.GET('/Authentication/Users')
    setUsers(usersData ?? [])
  }

  useEffect(() => {
    refresh().then()
    // 更新公钥
    const getPublicKey = async () => {
      const { data } = await openapi.GET('/Authentication/GetKey', {
        parseAs: 'text',
      })
      if (data) localStorage.setItem('publicKey', data)
    }
    getPublicKey().then()
  }, [])

  /* 角色保存 */
  const saveRole = async () => {
    if (!editRole) return
    let failed = undefined
    if (editRole.Id) {
      const { error } = await openapi.PUT('/Authentication/ModifyRole', {
        body: editRole,
      })
      if (error) failed = error
    } else {
      const { error } = await openapi.POST('/Authentication/AddRole', {
        body: editRole,
      })
      if (error) failed = error
    }
    if (failed) return
    setRoleDialogOpen(false) // 关闭弹窗
    setEditRole(null) // 清空编辑状态
    refresh().then()
  }

  /* 用户保存 */
  const saveUser = async () => {
    if (!editUser) return
    const password =
      rsaEncrypt(editUser.Password?.toString() ?? '') || undefined
    const body = { ...editUser, Role: selectedRoles, Password: password }
    let failed = undefined
    if (editUser?.Id) {
      const { error } = await openapi.PUT('/Authentication/ModifyUser', {
        body,
      })
      if (error) failed = error
    } else {
      const { error } = await openapi.POST('/Authentication/Register', { body })
      if (error) failed = error
    }
    if (failed) return
    setUserDialogOpen(false) // 关闭弹窗
    setEditUser(null) // 清空编辑状态
    setSelectedRoles([]) // 清空选中角色
    refresh().then()
  }

  /* 打开授权 Dialog */
  const openAuthorizeDialog = async (
    type: 'user' | 'role',
    target: User | Role,
  ) => {
    setAuthorizeType(type)
    setAuthorizeTarget(target)

    // 加载已授权列表
    const { data: grantedList } =
      type === 'user'
        ? await openapi.GET('/Authentication/UserControllers', {
            params: {
              query: {
                userId: (target as User).Id?.toString(),
                isGranted: true,
              },
            },
          })
        : await openapi.GET('/Authentication/RoleControllers', {
            params: {
              query: {
                roleId: (target as Role).Id?.toString(),
                isGranted: true,
              },
            },
          })

    // 加载未授权列表
    const { data: unGrantedList } =
      type === 'user'
        ? await openapi.GET('/Authentication/UserControllers', {
            params: {
              query: {
                userId: (target as User).Id?.toString(),
                isGranted: false,
              },
            },
          })
        : await openapi.GET('/Authentication/RoleControllers', {
            params: {
              query: {
                roleId: (target as Role).Id?.toString(),
                isGranted: false,
              },
            },
          })

    setGrantedControllers(grantedList ?? []) // 已授权控制器列表
    setUnGrantedControllers(unGrantedList ?? []) // 未授权控制器列表

    // 记录初始的授权ID数据
    const ids = (grantedList ?? []).map((c) => c.Id!)
    setInitialGrantedIds(ids)
    // 打开时默认已授权全部选中，可供用户取消选择
    setGrantedCheckedIds(ids)
    // 未授权列表初始为空
    setUnGrantedCheckedIds([])
    // 打开对话框
    setAuthorizeDialogOpen(true)
  }

  /* 授权页面确认 */
  const handleAuthorizeConfirm = async () => {
    if (!authorizeTarget) return
    // 需要新增的：未授权中勾选的
    const toAdd = unGrantedCheckedIds
    // 需要删除的：initialGrantedIds 中原本有，但当前取消勾选的
    const toDelete = initialGrantedIds.filter(
      (id) => !grantedCheckedIds.includes(id),
    )

    for (const id of toAdd) {
      if (authorizeType === 'user') {
        await openapi.POST('/Authentication/AddUserGrant', {
          params: {
            query: { userId: (authorizeTarget as User).Id, controllerId: id },
          },
        })
      } else {
        await openapi.POST('/Authentication/AddRoleGrant', {
          params: {
            query: { roleId: (authorizeTarget as Role).Id, controllerId: id },
          },
        })
      }
    }

    for (const id of toDelete) {
      if (authorizeType === 'user') {
        await openapi.DELETE('/Authentication/DeleteUserGrant', {
          params: {
            query: { userId: (authorizeTarget as User).Id, controllerId: id },
          },
        })
      } else {
        await openapi.DELETE('/Authentication/DeleteRoleGrant', {
          params: {
            query: { roleId: (authorizeTarget as Role).Id, controllerId: id },
          },
        })
      }
    }

    // 刷新本弹窗数据
    await openAuthorizeDialog(authorizeType!, authorizeTarget)
  }

  return (
    <div className="max-w-8xl mx-auto w-full gap-6 p-8">
      <Tabs defaultValue="statistics">
        {/* 一级 Tabs */}
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="statistics" className="w-1/3">
            系统统计
          </TabsTrigger>
          <TabsTrigger value="account" className="w-1/3">
            用户
          </TabsTrigger>
          <TabsTrigger value="role" className="w-1/3">
            角色
          </TabsTrigger>
        </TabsList>

        {/* Statistics Tab */}
        <TabsContent value="statistics">
          <CameraChart cameraId="0" />
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>所有用户</CardTitle>
              <Button
                variant="outline"
                onClick={() => {
                  setEditUser({})
                  setSelectedRoles([])
                  setUserDialogOpen(true)
                }}
              >
                <UserRoundPlus />
              </Button>
            </CardHeader>
            <CardContent className="max-h-[500px] overflow-y-auto">
              <table className="w-full table-auto border-collapse text-left">
                <thead>
                  <tr className="border-b">
                    <th className="p-2">ID</th>
                    <th className="p-2">邮箱</th>
                    <th className="p-2">昵称</th>
                    <th className="p-2">角色</th>
                    <th className="w-32 p-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.Id} className="border-b">
                      <td className="p-2">{user.Id}</td>
                      <td className="p-2">{user.Email}</td>
                      <td className="p-2">{user.NickName}</td>
                      <td className="flex-wrap gap-2 overflow-x-auto p-2">
                        {user.Role?.map((id) => {
                          const role = roles.find((r) => r.Id === id)
                          return role ? (
                            <Badge key={id}>{role.Name}</Badge>
                          ) : null
                        })}
                      </td>
                      <td className="flex gap-2 p-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditUser(user)
                            setSelectedRoles(user.Role || [])
                            setUserDialogOpen(true)
                          }}
                        >
                          <UserRoundPen />
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => openAuthorizeDialog('user', user)}
                        >
                          <Shield />
                        </Button>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="destructive">
                              <UserRoundX />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-40 p-2">
                            <p className="mb-2 text-sm">确定要删除该用户吗？</p>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  await openapi.DELETE(
                                    '/Authentication/DeleteUser',
                                    {
                                      params: { query: { userId: user.Id } },
                                    },
                                  )
                                  refresh().then()
                                }}
                              >
                                <Check />
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Role Tab */}
        <TabsContent value="role">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Roles</CardTitle>
              <Button
                variant="outline"
                onClick={() => {
                  setEditRole({})
                  setRoleDialogOpen(true)
                }}
              >
                <ShieldPlus />
              </Button>
            </CardHeader>
            <CardContent className="max-h-[400px] overflow-y-auto">
              <table className="w-full table-auto border-collapse text-left">
                <thead>
                  <tr className="border-b">
                    <th className="p-2">ID</th>
                    <th className="p-2">名称</th>
                    <th className="w-32 p-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.Id} className="border-b">
                      <td className="p-2">{role.Id}</td>
                      <td className="p-2">{role.Name}</td>
                      <td className="flex gap-2 p-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditRole(role)
                            setRoleDialogOpen(true)
                          }}
                        >
                          <Pen />
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => openAuthorizeDialog('role', role)}
                        >
                          <Shield />
                        </Button>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="destructive">
                              <ShieldX />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-40 p-2">
                            <p className="mb-2 text-sm">确定要删除该角色吗？</p>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  await openapi.DELETE(
                                    '/Authentication/DeleteRole',
                                    {
                                      params: { query: { roleId: role.Id } },
                                    },
                                  )
                                  refresh().then()
                                }}
                              >
                                <Check />
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 角色弹窗 */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editRole?.Id ? '编辑角色' : '新增角色'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label>名称</Label>
            <Input
              value={editRole?.Name || ''}
              onChange={(e) =>
                setEditRole({ ...editRole!, Name: e.target.value })
              }
            />
            <Button variant="outline" onClick={saveRole}>
              <Check />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 用户弹窗 */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editUser?.Id ? '编辑用户' : '新增用户'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label>邮箱</Label>
            <Input
              value={editUser?.Email || ''}
              onChange={(e) =>
                setEditUser({ ...editUser!, Email: e.target.value })
              }
            />

            <Label>昵称</Label>
            <Input
              value={editUser?.NickName || ''}
              onChange={(e) =>
                setEditUser({ ...editUser!, NickName: e.target.value })
              }
            />

            <Label>密码</Label>
            <Input
              type="password"
              value={editUser?.Password || ''}
              onChange={(e) =>
                setEditUser({ ...editUser!, Password: e.target.value })
              }
            />

            <Label>角色</Label>
            <div className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded border p-2">
              {roles.map((role) => (
                <label key={role.Id} className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedRoles.includes(role.Id!)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedRoles([...selectedRoles, role.Id!])
                      } else {
                        setSelectedRoles(
                          selectedRoles.filter((id) => id !== role.Id),
                        )
                      }
                    }}
                  />
                  <span>{role.Name}</span>
                </label>
              ))}
            </div>

            <Button variant="outline" onClick={saveUser}>
              <Check />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 授权弹窗 */}
      <Dialog
        open={authorizeDialogOpen}
        onOpenChange={(v) => {
          setAuthorizeDialogOpen(v)
          if (!v) {
            setGrantedCheckedIds([])
            setUnGrantedCheckedIds([])
          }
        }}
      >
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>
              {authorizeType === 'user'
                ? `用户授权：${(authorizeTarget as User)?.NickName}`
                : `角色授权：${(authorizeTarget as Role)?.Name}`}
            </DialogTitle>
          </DialogHeader>

          {/* 未授权列表 */}
          <Label>未授权</Label>
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded border p-2">
            {unGrantedControllers.map((ctrl) => (
              <label key={ctrl.Id} className="flex items-center gap-2">
                <Checkbox
                  checked={unGrantedCheckedIds.includes(ctrl.Id!)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setUnGrantedCheckedIds([...unGrantedCheckedIds, ctrl.Id!])
                    } else {
                      setUnGrantedCheckedIds(
                        unGrantedCheckedIds.filter((id) => id !== ctrl.Id),
                      )
                    }
                  }}
                />
                <span>{ctrl.Title}</span>
              </label>
            ))}
          </div>

          {/* 已授权列表 */}
          <Label className="mt-4">已授权</Label>
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded border p-2">
            {grantedControllers.map((ctrl) => (
              <label key={ctrl.Id} className="flex items-center gap-2">
                <Checkbox
                  checked={grantedCheckedIds.includes(ctrl.Id!)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setGrantedCheckedIds([...grantedCheckedIds, ctrl.Id!])
                    } else {
                      setGrantedCheckedIds(
                        grantedCheckedIds.filter((id) => id !== ctrl.Id),
                      )
                    }
                  }}
                />
                <span>{ctrl.Title}</span>
              </label>
            ))}
          </div>

          {/* 确认按钮 */}
          <Button variant="outline" onClick={handleAuthorizeConfirm}>
            <Check />
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
