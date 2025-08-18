'use client'

import CameraChart from '@/components/camera/camera-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function Page() {
  return (
    <div className="max-w-8xl mx-auto w-full gap-6 p-8">
      <Tabs defaultValue="statistics">
        {/* Tab 切换按钮 */}
        <TabsList className="mb-4 w-full">
          <TabsTrigger className="w-1/2" value="statistics">
            Statistics
          </TabsTrigger>
          <TabsTrigger className="w-1/2" value="account">
            Account
          </TabsTrigger>
        </TabsList>

        {/* 统计 */}
        <TabsContent value="statistics">
          <CameraChart cameraId="0" />
        </TabsContent>

        {/* 用户 / 角色管理 */}
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>用户管理</CardTitle>
            </CardHeader>
            <CardContent>
              {/* 将来这里放用户列表 + 新增、编辑、删除按钮 */}
              <p className="text-muted-foreground text-sm"></p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
