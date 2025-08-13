'use client'

import SegmentPlayer from '@/components/camera/segment-player'
import {useEffect, useState} from 'react'

export default function Page({
  params,
}: Readonly<{
  params: Promise<{ locale: string; camera: string }>
}>) {
  const [cameraInfo, setCameraInfo] = useState('')
  useEffect(() => {
    params.then(({ camera }) => {
      setCameraInfo(camera)
    })
  }, [params])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black p-4 text-white md:p-8">
      <h1 className="mb-6 text-3xl font-bold">
        Camera Playback - {cameraInfo || 'Loading...'}
      </h1>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-xl bg-gray-800 p-6">
          <SegmentPlayer />
        </div>
      </div>
    </div>
  )
}
