<script>
	/**
	 * [ 뽀득 AI 전문 진단 시스템 v3.0: 제로 카테고리 & 인간적 피드백 ]
	 * 1. 제로 카테고리: 첫 화면에 버튼 대신 "어떤 도움이 필요하신가요?"라는 질문으로 시작.
	 * 2. 자동 분류: 고객의 첫 마디를 분석해 [공간/오염/배출/마인드셋] 중 하나로 자동 배정.
	 * 3. 공감 피드백: 고객의 답변을 받으면 "그 부분은 정말 신경 쓰이시겠네요" 같은 피드백 후 다음 질문.
	 * 4. 채팅 집중 UI: 질문-답변-피드백이 하나의 흐름으로 이어지며 몰입감 극대화.
	 */

	import { onMount } from 'svelte';

	let GoogleGenerativeAI;
	let genAI;

	// 상담 단계: 0(첫 인사), 1(주제 분석 및 분류), 2(상세 상황 질의), 3(최종 진단)
	let step = 0;
	let mainCategory = '';
	let subTopic = '';
	let userDetail = '';
	let chatLog = [
		{
			role: 'ai',
			text: '안녕하세요, 뽀득 AI 상담 도우미입니다. 😊\n어떤 청소나 정리가 고민이신가요? 편하게 말씀해 주시면 제가 진단을 도와드릴게요.'
		}
	];

	let userInput = '';
	let isLoading = false;
	let resultHtml = '';
	let imageInput;

	// 분류용 키워드 맵
	const categoryMap = {
		space: ['이사', '입주', '거주', '전체', '부분', '아파트', '빌라'],
		stain: ['창틀', '곰팡이', '주방', '욕실', '기름때', '바닥', '얼룩', '니코틴'],
		recycle: ['쓰레기', '분리수거', '가구', '가전', '버리기', '봉투', '배출'],
		mind: ['귀찮', '막막', '포기', '방법', '루틴', '매일', '시작']
	};

	// 피드백 맵 (인간적인 반응)
	const feedbackMsgs = {
		space: '공간 전체를 돌보는 건 정말 큰 일이죠. 꼼꼼한 계획이 필요하겠네요.',
		stain: '특정 구역의 오염은 눈에 띌 때마다 스트레스가 크셨을 것 같아요.',
		recycle: '분리수거는 알면 쉽지만 모르면 정말 헷갈리는 부분이죠. 제가 짚어드릴게요.',
		mind: '청소를 시작하려는 그 마음 자체가 이미 절반은 성공하신 거예요!'
	};

	onMount(async () => {
		try {
			const module = await import('https://esm.run/@google/generative-ai');
			GoogleGenerativeAI = module.GoogleGenerativeAI;
			const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
			if (API_KEY) genAI = new GoogleGenerativeAI(API_KEY);
		} catch (e) {
			console.error('API 로드 실패', e);
		}
	});

	// 첫 답변을 통한 카테고리 자동 분류 및 피드백
	function processFirstInput() {
		if (!userInput.trim()) return;

		subTopic = userInput;
		chatLog = [...chatLog, { role: 'user', text: userInput }];

		// 키워드 분석으로 카테고리 매칭
		mainCategory = 'stain'; // 기본값
		for (const [cat, keywords] of Object.entries(categoryMap)) {
			if (keywords.some((k) => userInput.includes(k))) {
				mainCategory = cat;
				break;
			}
		}

		const feedback = feedbackMsgs[mainCategory];
		let nextQuestion = '';

		if (mainCategory === 'space')
			nextQuestion =
				'현재 비어있는 집(이사/입주)인가요, 아니면 살고 계신 집인가요? 그리고 대략적인 평수도 알려주세요.';
		else if (mainCategory === 'stain')
			nextQuestion = '그 구역의 오염 상태는 어떤가요? (예: 곰팡이가 깊다, 기름때가 딱딱하다 등)';
		else if (mainCategory === 'recycle')
			nextQuestion = '어떤 물건을 버리려고 하시나요? 혹은 사진을 찍어 보여주셔도 좋습니다.';
		else nextQuestion = '지금 가장 먼저 해결하고 싶은 한 곳만 고른다면 어디인가요?';

		setTimeout(() => {
			chatLog = [...chatLog, { role: 'ai', text: `${feedback}\n\n${nextQuestion}` }];
			step = 2;
			userInput = '';
		}, 600);
	}

	async function runAI() {
		if (!userInput.trim()) return;
		userDetail = userInput;
		chatLog = [...chatLog, { role: 'user', text: userInput }];
		isLoading = true;
		userInput = '';

		try {
			const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
			const prompt = `[뽀득 전문가 모드]\n상황: ${subTopic} / 상세: ${userDetail}\n[미션] 사장님의 15년 노하우를 담아 아주 친절하고 전문적인 진단 리포트를 작성해줘.`;

			let parts = [prompt];
			if (imageInput?.files[0]) {
				const base64 = await new Promise((r) => {
					const reader = new FileReader();
					reader.onloadend = () => r(reader.result.split(',')[1]);
					reader.readAsDataURL(imageInput.files[0]);
				});
				parts.push({ inlineData: { data: base64, mimeType: imageInput.files[0].type } });
			}

			const result = await model.generateContent(parts);
			resultHtml = `<strong>✨ 뽀득 전문 진단 리포트 ✨</strong><br><br>${result.response.text().replace(/\n/g, '<br>')}`;
			chatLog = [
				...chatLog,
				{ role: 'ai', text: '분석을 마쳤습니다. 아래 리포트를 확인해 주세요!' }
			];
		} catch (e) {
			chatLog = [
				...chatLog,
				{ role: 'ai', text: '죄송해요, 분석 중에 살짝 문제가 생겼어요. 다시 시도해 볼까요?' }
			];
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="app">
	<header>
		<div class="brand">BBODDEUK EXPERT</div>
		<h1>뽀득 AI 상담실</h1>
	</header>

	<div class="chat-window">
		{#each chatLog as chat}
			<div class="msg {chat.role}">
				<div
					class="bubble {chat.role === 'ai' && chat.text.includes('진단 리포트')
						? 'report-link'
						: ''}"
				>
					{chat.text}
				</div>
			</div>
		{/each}

		{#if isLoading}
			<div class="msg ai">
				<div class="bubble dot-loading">뽀득 전문가가 생각 중...</div>
			</div>
		{/if}
	</div>

	<div class="input-area">
		{#if step === 2}
			<div class="file-upload fade-in">
				<label for="file-pc">📸 현장 사진 첨부 (선택)</label>
				<input type="file" id="file-pc" bind:this={imageInput} accept="image/*" />
			</div>
		{/if}

		<div class="input-box">
			<input
				type="text"
				bind:value={userInput}
				placeholder={step === 0
					? '예: 이사 청소 문의해요, 창틀 곰팡이 해결법...'
					: '상세하게 말씀해 주세요...'}
				on:keypress={(e) => e.key === 'Enter' && (step < 2 ? processFirstInput() : runAI())}
			/>
			<button on:click={() => (step < 2 ? processFirstInput() : runAI())} disabled={isLoading}>
				전송
			</button>
		</div>

		{#if step > 0}
			<button
				class="btn-reset"
				on:click={() => {
					step = 0;
					chatLog = [chatLog[0]];
					resultHtml = '';
					userInput = '';
				}}>처음으로</button
			>
		{/if}
	</div>

	{#if resultHtml}
		<div class="result-viewer fade-in">
			{@html resultHtml}
			<button class="close-res" on:click={() => (resultHtml = '')}>닫기</button>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		background: #f0f2f5;
		font-family: 'Pretendard', sans-serif;
		margin: 0;
		padding: 0;
	}
	.app {
		max-width: 500px;
		margin: 0 auto;
		background: #fff;
		height: 100vh;
		display: flex;
		flex-direction: column;
		position: relative;
	}

	header {
		padding: 20px;
		border-bottom: 1px solid #f0f0f0;
		text-align: center;
	}
	.brand {
		color: #1a73e8;
		font-weight: 800;
		font-size: 12px;
		letter-spacing: 1px;
	}
	h1 {
		font-size: 18px;
		margin: 5px 0 0;
		color: #333;
	}

	.chat-window {
		flex: 1;
		overflow-y: auto;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 15px;
		background: #f9f9f9;
	}
	.msg {
		display: flex;
		flex-direction: column;
	}
	.msg.ai {
		align-items: flex-start;
	}
	.msg.user {
		align-items: flex-end;
	}
	.bubble {
		max-width: 80%;
		padding: 12px 16px;
		border-radius: 18px;
		font-size: 14px;
		line-height: 1.6;
		white-space: pre-wrap;
		position: relative;
	}
	.msg.ai .bubble {
		background: #fff;
		color: #333;
		border-top-left-radius: 2px;
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
	}
	.msg.user .bubble {
		background: #1a73e8;
		color: #fff;
		border-top-right-radius: 2px;
	}

	.input-area {
		padding: 20px;
		background: #fff;
		border-top: 1px solid #eee;
	}
	.input-box {
		display: flex;
		gap: 10px;
	}
	input {
		flex: 1;
		padding: 12px 15px;
		border: 1px solid #ddd;
		border-radius: 25px;
		outline: none;
		font-size: 14px;
	}
	button {
		background: #1a73e8;
		color: white;
		border: none;
		padding: 10px 20px;
		border-radius: 25px;
		font-weight: bold;
		cursor: pointer;
	}

	.file-upload {
		margin-bottom: 10px;
	}
	.file-upload label {
		font-size: 12px;
		color: #666;
		font-weight: bold;
		cursor: pointer;
		display: inline-block;
		padding: 5px 10px;
		background: #f0f0f0;
		border-radius: 10px;
	}
	.file-upload input {
		display: none;
	}

	.btn-reset {
		width: 100%;
		margin-top: 10px;
		background: none;
		color: #999;
		font-size: 12px;
		font-weight: normal;
	}

	.result-viewer {
		position: absolute;
		top: 10%;
		left: 5%;
		right: 5%;
		bottom: 10%;
		background: #fff;
		border-radius: 25px;
		box-shadow: 0 10px 50px rgba(0, 0, 0, 0.2);
		padding: 30px;
		overflow-y: auto;
		z-index: 100;
		border: 2px solid #1a73e8;
	}
	.close-res {
		position: sticky;
		bottom: 0;
		width: 100%;
		margin-top: 20px;
		background: #333;
	}

	.dot-loading {
		font-style: italic;
		color: #888;
	}
	.fade-in {
		animation: fadeIn 0.3s ease-in;
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
