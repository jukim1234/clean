<script>
	/**
	 * [ 뽀드득클린 전문 진단 시스템 v3.4 최종 ]
	 * 1. UI 가독성: 상담번호와 본문 사이 간격(빈 줄) 추가.
	 * 2. 버튼 최적화: 저장 버튼 문구 간소화 및 상단 가이드 문구 수정.
	 * 3. 리포트 정제: 하단 불필요한 안내 문구 삭제로 전문성 강화.
	 */

	import { onMount } from 'svelte';

	export let data;
	export let params;

	let GoogleGenerativeAI;
	let genAI;

	let step = 0;
	let mainCategory = '';
	let subTopic = '';
	let userDetail = '';
	let currentReportId = '';
	let chatLog = [
		{
			role: 'ai',
			text: '안녕하세요. 뽀드득클린 상담 도우미입니다. 😊\n어떤 부분의 청소가 고민이신가요? 우선 크게 고민되는 이슈를 간략히 말씀해 주시면 제가 다음 안내를 도와드릴게요.',
			guide:
				'(예: 내 방 청소. 쓰레기가 많아요. / 방, 주방, 거실 청소 문의. 범위 선택 가능할지. / 기본적 청소 외에 창틀 곰팡이가 고민. / 분리 배출 방법이 너무 어려워요.)'
		}
	];

	let userInput = '';
	let isLoading = false;
	let resultHtml = '';
	let rawAiResponse = '';
	let imageInput;

	// : 기존 categoryMap 및 feedbackMsgs 삭제 (AI가 직접 판단하므로 불필요)

	onMount(async () => {
		try {
			const module = await import('https://esm.run/@google/generative-ai');
			GoogleGenerativeAI = module.GoogleGenerativeAI;
			const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
			// : 여기서는 Settings>Environment Variables 찾아서 키명, 값 입력해도 이상하게 작동 안해서, .env 에 넣었다.
			if (API_KEY) {
				genAI = new GoogleGenerativeAI(API_KEY);
			}
		} catch (e) {
			console.error('API 로드 실패', e);
		}
	});

	function generateReportId() {
		const now = new Date();
		const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
		const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
		return `${dateStr}-${randomStr}`;
	}

	// [수정] 1차 상담 단계: AI가 문의 내용을 분석하여 유동적인 가이드 제공 (고정 로직 제거)
	async function processFirstInput() {
		if (!userInput.trim()) return;
		subTopic = userInput;
		chatLog = [...chatLog, { role: 'user', text: userInput }];
		isLoading = true;
		const tempInput = userInput;
		userInput = '';

		try {
			const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
			const guidePrompt = `
[역할] 전문 청소 상담사. 
[목적] 고객의 첫 문의 내용을 확인하고, 더 정확한 진단을 위해 필요한 '추가 정보'를 정중하고 신뢰감 있게 요청하세요.
[규칙] 
1. 과한 미사여구 없이 담백하고 전문적인 용어를 사용하세요.
2. 고객의 고민에 공감한 뒤, 평수/오염도/특이사항 중 해당 상황에 필요한 내용을 질문하세요.
3. 응답은 2~3문장 이내로 간결하게 작성하세요.
[고객문의]: ${tempInput}
`;
			const result = await model.generateContent(guidePrompt);
			const aiGuide = result.response.text();

			chatLog = [...chatLog, { role: 'ai', text: aiGuide }];
			step = 2;
		} catch (e) {
			console.error('1차 가이드 생성 오류:', e);
			chatLog = [...chatLog, { role: 'ai', text: '죄송합니다. 상담 가이드를 생성하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }];
		} finally {
			isLoading = false;
		}
	}

	async function runAI() {
		console.log('현재 genAI 상태:', genAI);

		if (!userInput.trim()) return;
		userDetail = userInput;
		chatLog = [...chatLog, { role: 'user', text: userDetail }];
		isLoading = true;
		userInput = '';
		currentReportId = generateReportId();

		try {
			const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
			// [업데이트된 뽀드득클린 전용 인스트럭션]
			const styleInstruction = `
[역할] 뽀드득클린(BBODDEUK) 전담 청소 진단 전문가. 
[뽀드득클린 운영 철학] 
1. 정직함과 논리적 인과관계 중시 (대표님의 대치동 강사 마인드 반영).
2. 하청 없는 직영 시스템의 책임감.
[응답 규칙]
1. 서두 인사나 자기소개, 운영 철학에 대한 긴 설명은 생략하고 **곧바로 구체적인 진단과 해결책**으로 시작하세요.
2. 답변은 논리적이고 객관적이어야 하며, 군더더기 없는 담백한 말투를 사용하세요.
3. [뽀드득클린 원칙 필수 반영]:
   - '탈거': 하수구, 환풍구, 걸레받이, 전등갓, 서랍장 등 분리 가능한 모든 곳의 '전체 탈거 세척' 원칙 명시.
   - '범위': 외창(바깥 유리면) 및 난간은 안전상 제외됨을 명확히 고지.
   - '추가비용': 곰팡이/니코틴/시트지/과한 쓰레기는 현장 오염도에 따라 추가 비용 가능성 사전 안내.
   - '기본품질': 친환경 세제와 고온 스팀 살균은 기본 포함임.
4. 별표(*)나 표(Table) 금지. 마지막에 [작업자 현장 체크 리스트] 2~3줄 요약 필수.
`;

			let prompt = `${styleInstruction}\n\n주제: ${subTopic}\n세부문의: ${userDetail}`;

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
			rawAiResponse = result.response.text().replace(/\*\*/g, '').replace(/\|/g, '');

			const fixedHeader = `<span class="highlight-text">진단이 완료되었습니다. 아래 리포트를 저장하여 채팅 상담 시 전달해 주세요.</span>\n`;
			// 상담번호 다음에 빈 줄 한 줄 추가 (<br><br>)
			resultHtml =
				fixedHeader +
				`<span style="font-size:12px;color:#888;">상담번호: ${currentReportId}</span><br><br>` +
				rawAiResponse.replace(/\n/g, '<br>');

			chatLog = [
				...chatLog,
				{
					role: 'ai',
					text: '진단 리포트가 준비되었습니다! 아래 버튼을 눌러 확인 후 저장해 주세요.',
					isReport: true
				}
			];
		} catch (e) {
			console.error('진짜 에러 원인:', e);
			chatLog = [...chatLog, { role: 'ai', text: '죄송합니다. 분석 중 오류가 발생했습니다.' }];
		} finally {
			isLoading = false;
		}
	}

	async function downloadReport() {
		const date = new Date().toLocaleString();
		let imgTag = '';
		if (imageInput?.files[0]) {
			const base64 = await new Promise((r) => {
				const reader = new FileReader();
				reader.onload = () => r(reader.result);
				reader.readAsDataURL(imageInput.files[0]);
			});
			imgTag = `<div class="section-title">현장 사진</div><img src="${base64}" style="max-width:100%; border-radius:10px;">`;
		}

		const reportHtml = `
		<!DOCTYPE html>
		<html>
		<head><meta charset="utf-8"><title>뽀드득클린 진단서</title>
		<style>
			body { font-family: sans-serif; line-height: 1.6; color: #333; padding: 20px; background: #f5f5f5; }
			.paper { background: #fff; padding: 40px; max-width: 700px; margin: 0 auto; border-top: 8px solid #1a73e8; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
			.title { color: #1a73e8; font-size: 24px; border-bottom: 2px solid #1a73e8; padding-bottom: 10px; margin-top:0; }
			.section-title { font-weight: bold; margin: 25px 0 10px; padding: 8px 12px; background: #f0f4f8; border-left: 5px solid #1a73e8; font-size: 16px; }
			.content { white-space: pre-wrap; margin-bottom: 20px; font-size: 15px; padding: 0 5px; }
			.meta { font-size: 12px; color: #777; margin-bottom: 20px; text-align: right; }
		</style>
		</head>
		<body>
			<div class="paper">
				<h1 class="title">청소 사전 진단 리포트</h1>
				<div class="meta">관리 번호: ${currentReportId}<br>일시: ${date}</div>
				
				<div class="section-title">상담 요약</div>
				<div class="content"><strong>주제:</strong> ${subTopic}</div>
				<div class="content"><strong>세부 문의:</strong> ${userDetail}</div>
				
				${imgTag}
				
				<div class="section-title">전문가 처방전 및 현장 체크리스트</div>
				<div class="content">${rawAiResponse}</div>
			</div>
		</body></html>`;

		const blob = new Blob([reportHtml], { type: 'text/html' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `뽀드득클린진단서_${currentReportId}.html`;
		a.click();
	}

	function resetConsultation() {
		step = 0;
		mainCategory = '';
		subTopic = '';
		userDetail = '';
		currentReportId = '';
		userInput = '';
		if (imageInput) imageInput.value = '';
		resultHtml = '';
		rawAiResponse = '';
		chatLog = [
			{
				role: 'ai',
				text: '안녕하세요, 뽀드득클린 상담 도우미입니다. 😊\n어떤 부분의 청소가 고민이신가요? 우선 크게 고민되는 이슈를 간략히 말씀해 주시면 제가 다음 안내를 도와드릴게요.',
				guide: '(예: 내 방 청소. 쓰레기가 많아요. / 방, 주방, 거실 청소 문의 / 창틀 곰팡이 고민 등)'
			}
		];
	}
</script>

<div class="app">
	<header>
		<div class="brand">BBODDEUK EXPERT</div>
		<h1>뽀드득클린 상담실</h1>
	</header>

	<div class="chat-container">
		<div class="chat-window">
			{#each chatLog as chat}
				<div class="msg {chat.role}">
					<div class="bubble">
						{chat.text}
						{#if chat.guide}
							<div class="guide-text">{chat.guide}</div>
						{/if}
						{#if chat.isReport}
							<button class="view-btn" on:click={() => (step = 3)}>📋 진단 리포트 확인하기</button>
						{/if}
					</div>
				</div>
			{/each}

			{#if isLoading}
				<div class="msg ai">
					<div class="bubble loading">전문가가 내용을 분석하고 있습니다...</div>
				</div>
			{/if}

			{#if step < 3}
				<div class="interactive-area fade-in">
					{#if step === 2}
						<div class="file-row">
							<label for="file-up">📸 현장 사진 첨부</label>
							<input type="file" id="file-up" bind:this={imageInput} accept="image/*" />
						</div>
					{/if}
					<div class="input-row">
						<input
							type="text"
							bind:value={userInput}
							placeholder="내용을 입력해주세요..."
							on:keypress={(e) => e.key === 'Enter' && (step < 2 ? processFirstInput() : runAI())}
						/>
						<button on:click={() => (step < 2 ? processFirstInput() : runAI())} disabled={isLoading}
							>전송</button
						>
					</div>

					{#if step > 0}
						<button
							class="reset-btn fade-in"
							on:click={resetConsultation}
							style="margin-top: 10px; background: #666; width: 100%; font-size: 12px; padding: 8px;"
							>🔄 새로운 상담 시작하기</button
						>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	{#if step === 3}
		<div class="result-modal fade-in">
			<div class="modal-content">
				<div class="res-body">{@html resultHtml}</div>
				<div class="btn-group">
					<button class="btn-down" on:click={downloadReport}>📄 리포트 저장</button>
					<button class="btn-close" on:click={() => (step = 2)}>닫기</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		background: #f5f7f9;
		font-family: 'Pretendard', sans-serif;
		margin: 0;
	}
	.app {
		max-width: 480px;
		margin: 0 auto;
		background: #fff;
		height: 100vh;
		display: flex;
		flex-direction: column;
		position: relative;
		border-left: 1px solid #eee;
		border-right: 1px solid #eee;
	}
	header {
		padding: 15px;
		border-bottom: 1px solid #eee;
		text-align: center;
		background: #fff;
	}
	.brand {
		color: #1a73e8;
		font-weight: 800;
		font-size: 11px;
		letter-spacing: 1px;
	}
	h1 {
		font-size: 17px;
		margin: 5px 0 0;
		color: #333;
	}
	.chat-container {
		flex: 1;
		overflow-y: auto;
		padding: 15px;
		background: #f9f9f9;
	}
	.chat-window {
		display: flex;
		flex-direction: column;
		gap: 12px;
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
		max-width: 85%;
		padding: 12px 16px;
		border-radius: 18px;
		font-size: 14px;
		line-height: 1.5;
		white-space: pre-wrap;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03);
		position: relative;
	}
	.msg.ai .bubble {
		background: #fff;
		color: #222;
		border-top-left-radius: 2px;
	}
	.msg.user .bubble {
		background: #1a73e8;
		color: #fff;
		border-top-right-radius: 2px;
	}
	.guide-text {
		margin-top: 10px;
		padding-top: 10px;
		border-top: 1px dashed #ddd;
		font-size: 12px;
		color: #666;
		font-weight: normal;
	}
	.interactive-area {
		margin-top: 10px;
	}
	.input-row {
		display: flex;
		gap: 8px;
	}
	input {
		flex: 1;
		padding: 12px 18px;
		border: 1.5px solid #1a73e8;
		border-radius: 25px;
		outline: none;
		font-size: 14px;
	}
	button {
		background: #1a73e8;
		color: white;
		border: none;
		padding: 0 20px;
		border-radius: 25px;
		font-weight: bold;
		cursor: pointer;
	}
	.view-btn {
		margin-top: 10px;
		width: 100%;
		background: #34a853;
		font-size: 12px;
		padding: 10px;
	}
	.btn-down {
		background: #34a853;
		padding: 14px;
		font-size: 13px;
	}
	.btn-close {
		background: #333;
		padding: 10px;
		font-size: 12px;
	}
	:global(.highlight-text) {
		color: #1a73e8;
		font-weight: bold;
		margin-bottom: 12px;
		display: block;
		font-size: 15px;
	}
	.loading {
		font-style: italic;
		color: #1a73e8;
	}
	.fade-in {
		animation: fadeIn 0.4s ease-out;
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(5px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.result-modal {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.6);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
	}
	.modal-content {
		background: #fff;
		width: 100%;
		max-width: 420px;
		max-height: 85vh;
		border-radius: 25px;
		padding: 25px;
		display: flex;
		flex-direction: column;
	}
	.res-body {
		flex: 1;
		overflow-y: auto;
		font-size: 14px;
		line-height: 1.7;
		padding-right: 10px;
		color: #333;
	}
	.btn-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 20px;
	}
	.file-row {
		margin-bottom: 8px;
	}
	.file-row label {
		font-size: 11px;
		color: #1a73e8;
		background: #e8f0fe;
		padding: 6px 12px;
		border-radius: 12px;
		cursor: pointer;
		display: inline-block;
		font-weight: bold;
	}
	.file-row input {
		display: none;
	}
</style>
