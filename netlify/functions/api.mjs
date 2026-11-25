import { handleApi } from '../../server/api.mjs';
export default (request, context) => handleApi(request, context);
export const config = { path: '/api/*' };
