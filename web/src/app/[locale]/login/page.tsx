'use client'

import { components } from '@/api/schema'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { openapi } from '@/lib/http'
import { rsaEncrypt } from '@/lib/security'
import { GalleryVerticalEnd } from 'lucide-react'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export default function Page() {
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [oidcAddress, setOidcAddress] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    // 更新公钥
    const getPublicKey = async () => {
      const { data } = await openapi.GET('/Authentication/GetKey', {
        parseAs: 'text',
      })
      if (data) localStorage.setItem('publicKey', data)
    }
    // 获取OIDC地址
    const getOidcAddress = async () => {
      const { data } = await openapi.GET('/Authentication/OidcLoginAddress', {
        parseAs: 'text',
      })
      setOidcAddress(data ?? '')
    }
    getPublicKey().then()
    getOidcAddress().then()
  }, [])

  /* 跳转 */
  const redirect = () => {
    const redirect = searchParams.get('redirect')
    if (redirect) {
      router.replace(redirect)
    } else {
      router.replace(`/${locale}/dashboard`)
    }
  }

  /* 登录 */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    const passwordEncrypted = rsaEncrypt(password)
    if (!passwordEncrypted) {
      toast.error('Password encryption failed')
      return
    }
    const body: components['schemas']['SystemUser'] = {
      Email: email,
      Password: passwordEncrypted,
    }
    const { data } = await openapi.POST('/Authentication/Login', {
      body: body,
      parseAs: 'text',
    })
    if (data) {
      localStorage.setItem('token', data)
      redirect()
    }
  }

  /* OIDC登录 */
  const handleOidcLogin = () => {
    if (oidcAddress.length == 0) return
    // 打开一个小窗口执行 OIDC 登录
    window.open(oidcAddress, 'OIDCLogin', 'width=500,height=600')
    // 监听从回调窗口发送的消息
    const messageHandler = (event: MessageEvent) => {
      // 获取返回信息
      const { token, error } = event.data
      if (error) {
        toast.error('OIDC login failed: ' + error)
        return
      }
      // 登录成功
      if (token) {
        localStorage.setItem('token', token)
        redirect()
      } else {
        toast.error('OIDC login failed: no token received')
      }

      // 移除事件监听，避免多次触发
      window.removeEventListener('message', messageHandler)
    }

    window.addEventListener('message', messageHandler)
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link
          href="/"
          className="flex items-center gap-2 self-center font-medium"
        >
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
            <GalleryVerticalEnd className="size-4" />
          </div>
          Time Capsule
        </Link>
        {/*  登录信息 */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Welcome back</CardTitle>
              {oidcAddress.length > 0 && (
                <CardDescription>Login with</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                {/*其他登录方式*/}
                {oidcAddress.length > 0 && (
                  <div className="flex flex-col gap-4">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleOidcLogin}
                    >
                      <svg
                        viewBox="0 0 1000 1000"
                        xmlns="http://www.w3.org/2000/svg"
                        p-id="5606"
                        width="200"
                        height="200"
                      >
                        <path
                          d="M507.2896 133.44768l130.98496-71.4496v820.9408l-130.97984 69.71392V133.44768z"
                          fill="currentColor"
                          p-id="5607"
                        ></path>
                        <path
                          d="M479.39072 323.968a724.30592 724.30592 0 0 0-77.056 16.6144C118.35904 417.01376 37.77536 603.8016 67.95776 701.696c30.11584 97.8944 161.03424 263.2192 439.2704 250.19904 0.13824-27.41248 0.13824-57.73824 0-90.89536-200.49408-26.37824-302.67904-88.82688-306.55488-187.40736-5.74464-147.74272 134.1696-216.90368 217.87136-229.0176 16.82432-2.49344 37.66272-5.67808 61.19936-8.6528l-0.27648-111.9488h-0.07168z m185.12384 107.65312c52.1984 5.6832 103.57248 18.69312 147.0464 44.44672-10.65984 5.19168-34.26816 19.73248-70.82496 43.47904l290.49344 66.39104-16.54272-206.58176-78.37184 44.30336c-116.10112-57.8048-205.19936-91.0336-267.29984-99.6864l-4.50048 107.648z"
                          fill="currentColor"
                          p-id="5608"
                        ></path>
                      </svg>
                      Login with OIDC
                    </Button>
                  </div>
                )}
                {oidcAddress.length > 0 && (
                  <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
                    <span className="bg-card text-muted-foreground relative z-10 px-2">
                      Or continue with
                    </span>
                  </div>
                )}
                {/*登录表单*/}
                <form onSubmit={handleLogin}>
                  <div className="grid gap-6">
                    <div className="grid gap-3">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="account@example.com"
                        required
                      />
                    </div>
                    <div className="grid gap-3">
                      <div className="flex items-center">
                        <Label htmlFor="password">Password</Label>
                        <Link
                          href="#"
                          className="ml-auto text-sm underline-offset-4 hover:underline"
                        >
                          Forgot your password?
                        </Link>
                      </div>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={!email || !password}
                    >
                      Login
                    </Button>
                  </div>
                </form>
                {/*注册*/}
                <div className="text-center text-sm">
                  Don&apos;t have an account?{' '}
                  <Link href="#" className="underline underline-offset-4">
                    Sign up
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
            By clicking continue, you agree to our{' '}
            <Link href="#">Terms of Service</Link> and{' '}
            <Link href="#">Privacy Policy</Link>.
          </div>
        </div>
      </div>
    </div>
  )
}
