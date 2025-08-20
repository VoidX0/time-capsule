'use client'

import { components } from '@/api/schema'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { rsaEncrypt } from '@/lib/security'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{t('account')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Avatar className="h-15 w-15 rounded-full">
            <AvatarFallback className="rounded-full">
              {(user?.NickName?.length ?? -1) > 0
                ? user?.NickName![0]!.toUpperCase()
                : ' '}
            </AvatarFallback>
          </Avatar>
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
