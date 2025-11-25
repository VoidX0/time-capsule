import { components } from '@/api/schema'
import { openapi } from '@/lib/http'

type QueryDto = components['schemas']['QueryDto']
type Camera = components['schemas']['Camera']

/**
 * 获取所有摄像头列表
 */
export async function getCameras(): Promise<Camera[] | undefined> {
  const body: QueryDto = { pageNumber: 1, pageSize: 1000 }
  const { data } = await openapi.POST('/Camera/Query', { body })
  return data?.items
}

/**
 * 根据 ID 获取摄像头信息
 * @param id
 */
export async function getCameraById(id: string): Promise<Camera | undefined> {
  const body: QueryDto = {
    pageNumber: 1,
    pageSize: 1,
    condition: [{ fieldName: 'Id', fieldValue: id, cSharpTypeName: 'long' }],
  }
  const { data } = await openapi.POST('/Camera/Query', { body })
  return data?.items[0]
}
