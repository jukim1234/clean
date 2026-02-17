import { GoogleGenerativeAI } from '@google/generative-ai';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private'; // VITE_가 없는 서버 전용 환경 변수 로드

export async function POST({ request }) {
	try {
		const { prompt, type } = await request.json();

		// Vercel 설정에 GEMINI_API_KEY라는 이름으로 저장된 값을 가져옵니다.
		const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
		const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

		// 이미지 데이터가 포함된 경우 처리 (parts 대응)
		const result = await model.generateContent(prompt);
		const text = result.response.text();

		return json({ text });
	} catch (e) {
		console.error('서버 AI 통신 에러:', e);
		return json({ error: 'AI 분석 중 오류가 발생했습니다.' }, { status: 500 });
	}
}
