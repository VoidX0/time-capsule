'use client'

import { components } from '@/api/schema'
import CameraChart from '@/components/camera/camera-chart'
import DetectionChart from '@/components/camera/detection-chart'
import StorageChart from '@/components/main/storage-chart'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { openapi } from '@/lib/http'
import { rsaEncrypt } from '@/lib/security'
import {
  Check,
  Pen,
  Shield,
  ShieldPlus,
  ShieldX,
  UserRoundPen,
  UserRoundPlus,
  UserRoundX,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

type Role = components['schemas']['SystemRole']
type User = components['schemas']['SystemUser']
type SystemController = components['schemas']['SystemController']

export default function Page() {
  const t = useTranslations('SettingsPage')
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
  const [avatarToken, setAvatarToken] = useState<string>('')

  /* 刷新数据 */
  const refresh = async () => {
    setAvatarToken(rsaEncrypt(Date.now().toString()) || '') // 更新Token

    const { data: rolesData } = await openapi.GET('/Authentication/Roles')
    setRoles(rolesData ?? [])
    const { data: usersData } = await openapi.GET('/Authentication/Users')
    setUsers(usersData ?? [])
  }

  useEffect(() => {
    const fetchData = async () => {
      await refresh()
    }
    fetchData().then()
  }, [])

  /* 角色保存 */
  const saveRole = async () => {
    if (!editRole) return
    let failed = undefined
    if (editRole.id) {
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
      rsaEncrypt(editUser.password?.toString() ?? '') || undefined
    const body = { ...editUser, Role: selectedRoles, Password: password }
    let failed = undefined
    if (editUser?.id) {
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
                userId: (target as User).id?.toString(),
                isGranted: true,
              },
            },
          })
        : await openapi.GET('/Authentication/RoleControllers', {
            params: {
              query: {
                roleId: (target as Role).id?.toString(),
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
                userId: (target as User).id?.toString(),
                isGranted: false,
              },
            },
          })
        : await openapi.GET('/Authentication/RoleControllers', {
            params: {
              query: {
                roleId: (target as Role).id?.toString(),
                isGranted: false,
              },
            },
          })

    setGrantedControllers(grantedList ?? []) // 已授权控制器列表
    setUnGrantedControllers(unGrantedList ?? []) // 未授权控制器列表

    // 记录初始的授权ID数据
    const ids = (grantedList ?? []).map((c) => c.id!)
    setInitialGrantedIds(ids.map((id) => Number(id)))
    // 打开时默认已授权全部选中，可供用户取消选择
    setGrantedCheckedIds(ids.map((id) => Number(id)))
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
            query: { userId: (authorizeTarget as User).id, controllerId: id },
          },
        })
      } else {
        await openapi.POST('/Authentication/AddRoleGrant', {
          params: {
            query: { roleId: (authorizeTarget as Role).id, controllerId: id },
          },
        })
      }
    }

    for (const id of toDelete) {
      if (authorizeType === 'user') {
        await openapi.DELETE('/Authentication/DeleteUserGrant', {
          params: {
            query: { userId: (authorizeTarget as User).id, controllerId: id },
          },
        })
      } else {
        await openapi.DELETE('/Authentication/DeleteRoleGrant', {
          params: {
            query: { roleId: (authorizeTarget as Role).id, controllerId: id },
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
            {t('statisticsTab')}
          </TabsTrigger>
          <TabsTrigger value="account" className="w-1/3">
            {t('accountTab')}
          </TabsTrigger>
          <TabsTrigger value="role" className="w-1/3">
            {t('roleTab')}
          </TabsTrigger>
        </TabsList>

        {/* Statistics Tab */}
        <TabsContent value="statistics" className="space-y-6">
          <CameraChart cameraId="0" />
          <DetectionChart cameraId="0" />
          <StorageChart />
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>{t('allUsers')}</CardTitle>
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
                    <th className="p-2" />
                    <th className="p-2">ID</th>
                    <th className="p-2">{t('email')}</th>
                    <th className="p-2">{t('nickname')}</th>
                    <th className="p-2">{t('role')}</th>
                    <th className="w-32 p-2">{t('operations')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b">
                      <td className="p-2">
                        <Avatar className="h-8 w-8 rounded-full">
                          {user && (
                            <AvatarImage
                              src={`/api/Authentication/GetAvatar?id=${user?.id?.toString()}&token=${encodeURIComponent(avatarToken)}`}
                              alt={user?.nickName ?? ''}
                            />
                          )}
                          <AvatarFallback className="rounded-full">
                            {(user?.nickName?.length ?? -1) > 0
                              ? user?.nickName![0]!.toUpperCase()
                              : ' '}
                          </AvatarFallback>
                        </Avatar>
                      </td>
                      <td className="p-2">{user.id}</td>
                      <td className="p-2">{user.email}</td>
                      <td className="p-2">{user.nickName}</td>
                      <td className="flex-wrap gap-2 overflow-x-auto p-2">
                        {user.role?.map((id) => {
                          const role = roles.find((r) => r.id === id)
                          return role ? (
                            <Badge key={id}>{role.name}</Badge>
                          ) : null
                        })}
                      </td>
                      <td className="flex gap-2 p-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditUser(user)
                            setSelectedRoles(
                              user.role?.map((v) => Number(v)) || [],
                            )
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
                            <p className="mb-2 text-sm">
                              {t('deleteUserConfirm')}
                            </p>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  await openapi.DELETE(
                                    '/Authentication/DeleteUser',
                                    {
                                      params: { query: { userId: user.id } },
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
              <CardTitle>{t('allRoles')}</CardTitle>
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
                    <th className="p-2">{t('role')}</th>
                    <th className="w-32 p-2">{t('operations')}</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.id} className="border-b">
                      <td className="p-2">{role.id}</td>
                      <td className="p-2">{role.name}</td>
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
                            <p className="mb-2 text-sm">
                              {t('deleteRoleConfirm')}
                            </p>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  await openapi.DELETE(
                                    '/Authentication/DeleteRole',
                                    {
                                      params: { query: { roleId: role.id } },
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
            <DialogTitle>
              {editRole?.id ? t('editRole') : t('addRole')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label>{t('role')}</Label>
            <Input
              value={editRole?.name || ''}
              onChange={(e) =>
                setEditRole({ ...editRole!, name: e.target.value })
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
            <DialogTitle>
              {editUser?.id ? t('editUser') : t('addUser')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label>{t('email')}</Label>
            <Input
              value={editUser?.email || ''}
              onChange={(e) =>
                setEditUser({ ...editUser!, email: e.target.value })
              }
            />

            <Label>{t('nickname')}</Label>
            <Input
              value={editUser?.nickName || ''}
              onChange={(e) =>
                setEditUser({ ...editUser!, nickName: e.target.value })
              }
            />

            <Label>{t('password')}</Label>
            <Input
              type="password"
              value={editUser?.password || ''}
              onChange={(e) =>
                setEditUser({ ...editUser!, password: e.target.value })
              }
            />

            <Label>{t('role')}</Label>
            <div className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded border p-2">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedRoles.includes(Number(role.id!))}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedRoles([...selectedRoles, Number(role.id!)])
                      } else {
                        setSelectedRoles(
                          selectedRoles.filter((id) => id !== role.id),
                        )
                      }
                    }}
                  />
                  <span>{role.name}</span>
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
                ? t('authorizeUser') +
                  '：' +
                  (authorizeTarget as User)?.nickName
                : t('authorizeRole') + '：' + (authorizeTarget as Role)?.name}
            </DialogTitle>
          </DialogHeader>

          {/* 未授权列表 */}
          <Label className="mt-2">{t('unauthorized')}</Label>
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded border p-2">
            {unGrantedControllers.map((ctrl) => (
              <label key={ctrl.id} className="flex items-center gap-2">
                <Checkbox
                  checked={unGrantedCheckedIds.includes(Number(ctrl.id!))}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setUnGrantedCheckedIds([
                        ...unGrantedCheckedIds,
                        Number(ctrl.id!),
                      ])
                    } else {
                      setUnGrantedCheckedIds(
                        unGrantedCheckedIds.filter((id) => id !== ctrl.id),
                      )
                    }
                  }}
                />
                <span>{ctrl.title}</span>
              </label>
            ))}
          </div>

          {/* 已授权列表 */}
          <Label className="mt-2">{t('authorized')}</Label>
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded border p-2">
            {grantedControllers.map((ctrl) => (
              <label key={ctrl.id} className="flex items-center gap-2">
                <Checkbox
                  checked={grantedCheckedIds.includes(Number(ctrl.id!))}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setGrantedCheckedIds([
                        ...grantedCheckedIds,
                        Number(ctrl.id!),
                      ])
                    } else {
                      setGrantedCheckedIds(
                        grantedCheckedIds.filter((id) => id !== ctrl.id),
                      )
                    }
                  }}
                />
                <span>{ctrl.title}</span>
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
