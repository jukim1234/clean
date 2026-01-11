import adapter from '@sveltejs/kit/node'; // 이 부분을 수정합니다
import { vitePreprocess } from '@sveltejs/kit/vite';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter() // Vercel이 이해할 수 있는 기본 어댑터 설정입니다
	}
};

export default config;
