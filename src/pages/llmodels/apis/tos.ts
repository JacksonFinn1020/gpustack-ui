import { request } from '@umijs/max';
import {
  Paginated,
  TosArchiveJobCreate,
  TosArchiveJobPublic,
  TosConnectionCreate,
  TosConnectionPublic,
  TosConnectionUpdate,
  TosReleaseListItem,
  TosReleasePublic
} from '../config/tos';

export const TOS_CONNECTIONS_API = '/tos/connections';
export const TOS_ARCHIVES_API = '/tos/archives';
export const TOS_RELEASES_API = '/tos/releases';

export async function queryTosConnections(params?: {
  page?: number;
  perPage?: number;
}) {
  return request<Paginated<TosConnectionPublic>>(TOS_CONNECTIONS_API, {
    method: 'GET',
    params
  });
}

export async function getTosConnection(id: number) {
  return request<TosConnectionPublic>(`${TOS_CONNECTIONS_API}/${id}`, {
    method: 'GET'
  });
}

export async function createTosConnection(data: TosConnectionCreate) {
  return request<TosConnectionPublic>(TOS_CONNECTIONS_API, {
    method: 'POST',
    data
  });
}

export async function updateTosConnection(
  id: number,
  data: TosConnectionUpdate
) {
  return request<TosConnectionPublic>(`${TOS_CONNECTIONS_API}/${id}`, {
    method: 'PUT',
    data
  });
}

export async function deleteTosConnection(id: number) {
  return request(`${TOS_CONNECTIONS_API}/${id}`, {
    method: 'DELETE'
  });
}

export async function queryTosReleaseCatalog(params: {
  connection_id: number;
  tos_model?: string;
}) {
  return request<TosReleaseListItem[]>(TOS_RELEASES_API, {
    method: 'GET',
    params
  });
}

export async function getTosReleaseDetail(params: {
  connection_id: number;
  tos_model: string;
  tos_version: string;
}) {
  return request<TosReleasePublic>(`${TOS_RELEASES_API}/detail`, {
    method: 'GET',
    params
  });
}

export async function queryTosArchives(params?: {
  page?: number;
  perPage?: number;
  worker_id?: number;
  model_file_id?: number;
  state?: string;
}) {
  return request<Paginated<TosArchiveJobPublic>>(TOS_ARCHIVES_API, {
    method: 'GET',
    params
  });
}

export async function getTosArchive(id: number) {
  return request<TosArchiveJobPublic>(`${TOS_ARCHIVES_API}/${id}`, {
    method: 'GET'
  });
}

export async function createTosArchive(data: TosArchiveJobCreate) {
  return request<TosArchiveJobPublic>(TOS_ARCHIVES_API, {
    method: 'POST',
    data
  });
}

export async function retryTosArchive(id: number) {
  return request<TosArchiveJobPublic>(`${TOS_ARCHIVES_API}/${id}/retry`, {
    method: 'POST'
  });
}
