import { mergeConfig } from 'vite';
import baseConfig from './vite.config';

export default mergeConfig(baseConfig, {
  cacheDir: '/tmp/wedding-spa-vite-cache',
});
