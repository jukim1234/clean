import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		allowedHosts: true // 모든 호스트 허용 (CodeSandbox 환경 대응)
	}
});
