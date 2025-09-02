'use client'

import { components } from '@/api/schema'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { openapi } from '@/lib/http'
import { rsaEncrypt } from '@/lib/security'
import { Pencil } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

type SystemUser = components['schemas']['SystemUser']

interface UserProfileDialogProps {
  user: SystemUser | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave?: (updatedUser: SystemUser) => void
}

export function UserProfileDialog({
  user,
  open,
  onOpenChange,
  onSave,
}: UserProfileDialogProps) {
  const t = useTranslations('MainLayout')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [form, setForm] = useState({
    Email: user?.Email ?? '',
    NickName: user?.NickName ?? '',
    Password: '',
  })

  useEffect(() => {
    setForm({
      Email: user?.Email ?? '',
      NickName: user?.NickName ?? '',
      Password: '',
    })
  }, [user, open])

  const handleChange = (
    field: 'Email' | 'NickName' | 'Password',
    value: string,
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    if (onSave) {
      const password = rsaEncrypt(form.Password)
      onSave({
        ...user!,
        Email: form.Email,
        NickName: form.NickName,
        Password: password == false ? user!.Password : password,
      })
    }
    onOpenChange(false)
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    await openapi.POST('/Authentication/SetAvatar', {
      body: formData as unknown as { file: string },
    })

    // 强制刷新头像 (加时间戳避免缓存)
    const avatarImg = document.getElementById(
      'user-avatar-img',
    ) as HTMLImageElement
    if (avatarImg) {
      avatarImg.src = `/api/Authentication/GetAvatar?id=${user?.Id}&t=${Date.now()}`
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{t('account')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* 头像 + 编辑按钮 */}
          <div className="relative w-fit">
            <Avatar className="h-20 w-20 rounded-full">
              <AvatarImage
                id="user-avatar-img"
                src={`/api/Authentication/GetAvatar?id=${user?.Id?.toString()}`}
                alt={user?.NickName ?? ''}
              />
              <AvatarFallback className="rounded-full">
                {(user?.NickName?.length ?? -1) > 0
                  ? user?.NickName![0]!.toUpperCase()
                  : ' '}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={handleUploadClick}
              className="absolute right-0 bottom-0 rounded-full bg-white p-1 shadow hover:bg-gray-100"
            >
              <Pencil className="h-4 w-4 text-gray-600" />
            </button>
            <input
              type="file"
              accept="image/png,image/jpeg"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* 表单部分 */}
          <div className="grid gap-1">
            <label className="text-sm font-medium">{t('changeEmail')}</label>
            <Input
              value={form.Email}
              onChange={(e) => handleChange('Email', e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">{t('changeNickname')}</label>
            <Input
              value={form.NickName}
              onChange={(e) => handleChange('NickName', e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">{t('changePassword')}</label>
            <Input
              type="password"
              value={form.Password}
              onChange={(e) => handleChange('Password', e.target.value)}
            />
          </div>
          <Button className="mt-2" onClick={handleSave}>
            {t('changeSave')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
