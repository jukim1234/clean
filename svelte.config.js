import adapter from '@sveltejs/adapter-auto'; // 'node' 대신 'adapter-auto'를 씁니다
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'; // 위치를 이쪽으로 수정했습니다

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter() // Vercel이 이해할 수 있는 기본 어댑터 설정입니다
	}
};

export default config;
