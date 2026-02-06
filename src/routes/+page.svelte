<script>
	/**
	 * [ 뽀득 AI 전문 진단 시스템 v3.2 통합본 ]
	 * 1. v3.1 대화형 UI: 입력창이 대화 흐름 바로 밑에 위치
	 * 2. v2.0 전문가 로직: 관리번호 생성, 제약 조건(3~5항목), 현장 체크리스트 포함
	 * 3. v1.0 리포트 기능: 현장 사진을 포함한 HTML 진단서 다운로드 기능 부활
	 * 4. 텍스트 정제: 출력 시 ** 표시 제거 및 표 형식 사용 금지 (가독성 최적화)
	 */

	import { onMount } from 'svelte';

	let GoogleGenerativeAI;
	let genAI;

	let step = 0; 
	let mainCategory = '';
	let subTopic = ''; 
	let currentReportId = ''; 
	let chatLog = [
		{ 
			role: 'ai', 
			text: "안녕하세요, 뽀득 AI 상담 도우미입니다. 😊\n어떤 부분의 청소가 고민이신가요? 우선 크게 고민되는 이슈를 간략히 말씀해 주시면 제가 다음 안내를 도와드릴게요.",
			guide: "(예: 내 방 청소. 쓰레기가 많아요. / 방, 주방, 거실 청소 문의. 범위 선택 가능할지. / 기본적 청소 외에 창틀 곰팡이가 고민. / 분리 배출 방법이 너무 어려워요.)"
		}
	];

	let userInput = '';
	let isLoading = false;
	let resultHtml = ''; // 화면 표시용
	let rawAiResponse = ''; // 리포트 저장용 순수 텍스트
	let imageInput;
	let responseHistory = [];

	const categoryMap = {
		space: ['이사', '입주', '거주', '전체', '부분', '아파트', '방', '문의', '범위'],
		stain: ['창틀', '곰팡이', '주방', '욕실', '기름때', '바닥', '얼룩', '니코틴'],
		recycle: ['쓰레기', '분리수거', '가구', '가전', '버리기', '배출', '방법'],
		mind: ['귀찮', '막막', '포기', '루틴', '매일', '시작']
	};

	const feedbackMsgs = {
		space: "공간 전체 혹은 핵심 구역을 정하는 게 우선이겠네요. 뽀득이 체계적으로 잡아드릴게요.",
		stain: "특정 구역의 찌든 오염은 전문가의 장비와 약품이 필요한 영역이죠. 잘 말씀해주셨습니다.",
		recycle: "분리 배출은 환경에도 중요하지만 정작 하려면 참 막막하죠. 깔끔하게 정리해 드릴게요.",
		mind: "청소를 결심하신 것만으로도 대단하십니다. 가벼운 마음으로 시작하실 수 있게 도와드릴게요."
	};

	onMount(async () => {
		try {
			const module = await import('https://esm.run/@google/generative-ai');
			GoogleGenerativeAI = module.GoogleGenerativeAI;
			const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
			if (API_KEY) genAI = new GoogleGenerativeAI(API_KEY);
		} catch (e) { console.error("API 로드 실패", e); }
	});

	function generateReportId() {
		const now = new Date();
		const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
		const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
		return `${dateStr}-${randomStr}`;
	}

	function processFirstInput() {
		if (!userInput.trim()) return;
		subTopic = userInput;
		chatLog = [...chatLog, { role: 'user', text: userInput }];
		
		mainCategory = 'stain'; 
		for (const [cat, keywords] of Object.entries(categoryMap)) {
			if (keywords.some(k => userInput.includes(k))) {
				mainCategory = cat;
				break;
			}
		}

		const feedback = feedbackMsgs[mainCategory];
		let nextQuestion = "";
		if (mainCategory === 'space') nextQuestion = "현재 비어있는 집인가요, 아니면 살고 계신 상태인가요? 평수나 특이사항이 있다면 말씀해주세요.";
		else if (mainCategory === 'stain') nextQuestion = "해당 오염이 발생한 지 얼마나 되었나요? 혹은 사진을 첨부해주시면 더 정확합니다.";
		else if (mainCategory === 'recycle') nextQuestion = "버리시려는 물건의 종류나 대략적인 양을 말씀해주시겠어요?";
		else nextQuestion = "지금 당장 5분만 투자한다면 가장 먼저 깨끗하게 만들고 싶은 곳은 어디인가요?";

		setTimeout(() => {
			chatLog = [...chatLog, { role: 'ai', text: `${feedback}\n\n${nextQuestion}` }];
			step = 2;
			userInput = '';
		}, 600);
	}

	async function runAI() {
		if (!userInput.trim()) return;
		const detailInput = userInput;
		chatLog = [...chatLog, { role: 'user', text: detailInput }];
		isLoading = true;
		userInput = '';
		currentReportId = generateReportId();

		try {
			const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
			
			const styleInstruction = `
				[역할] 15년 경력 청소 전문가. 
				[규칙] 
				1. ** 별표 기호나 표(Table) 형식을 절대 사용하지 마세요. 
				2. 3~5개 항목 이내로 간결하고 핵심적인 텍스트 위주로 답변하세요.
				3. 답변 마지막에 반드시 [작업자 현장 체크 리스트] 머리말과 함께 주의사항을 2~3줄 요약하세요.
				4. 인사말은 생략하고 즉시 솔루션을 제시하세요.`;

			let prompt = `${styleInstruction}\n\n[분류: ${mainCategory}]\n주제: ${subTopic}\n상황: ${detailInput}`;
			
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
			// ** 제거 및 정제
			rawAiResponse = result.response.text().replace(/\*\*/g, '').replace(/\|/g, ''); 
			
			const fixedHeader = `<span class="highlight-text">진단이 완료되었습니다. 아래 리포트를 확인하고 저장해 주세요.</span>\n`;
			resultHtml = fixedHeader + `<span style="font-size:12px;color:#888;">상담번호: ${currentReportId}</span>\n\n` + rawAiResponse.replace(/\n/g, '<br>');
			
			chatLog = [...chatLog, { role: 'ai', text: "진단 리포트 생성이 완료되었습니다. 아래 버튼을 눌러 확인해 보세요!", isReport: true }];
		} catch (e) { 
			chatLog = [...chatLog, { role: 'ai', text: "죄송합니다. 분석 중 오류가 발생했습니다." }];
		} finally { isLoading = false; }
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
		<head><meta charset="utf-8"><title>뽀득 AI 진단서</title>
		<style>
			body { font-family: sans-serif; line-height: 1.6; color: #333; padding: 20px; background: #f5f5f5; }
			.paper { background: #fff; padding: 40px; max-width: 700px; margin: 0 auto; border-top: 8px solid #1a73e8; }
			.title { color: #1a73e8; font-size: 24px; border-bottom: 2px solid #1a73e8; padding-bottom: 10px; }
			.section-title { font-weight: bold; margin: 20px 0 10px; padding: 5px 10px; background: #f0f4f8; border-left: 4px solid #1a73e8; }
			.content { white-space: pre-wrap; margin-bottom: 20px; }
		</style>
		</head>
		<body>
			<div class="paper">
				<h1 class="title">AI 청소 사전 진단 리포트</h1>
				<p>관리 번호: ${currentReportId} / 일시: ${date}</p>
				<div class="section-title">상담 요약</div>
				<div class="content">주제: ${subTopic}</div>
				${imgTag}
				<div class="section-title">전문가 처방전 및 현장 체크리스트</div>
				<div class="content">${rawAiResponse}</div>
				<p style="text-align:center; color:#888; font-size:12px;">본 리포트를 업체에 제시하시면 정확한 견적이 가능합니다.</p>
			</div>
		</body></html>`;

		const blob = new Blob([reportHtml], { type: 'text/html' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `뽀득진단서_${currentReportId}.html`;
		a.click();
	}
</script>

<div class="app">
	<header>
		<div class="brand">BBODDEUK EXPERT</div>
		<h1>뽀득 AI 상담실</h1>
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
							<button class="view-btn" on:click={() => step = 3}>📋 리포트 보기</button>
						{/if}
					</div>
				</div>
			{/each}

			{#if isLoading}
				<div class="msg ai"><div class="bubble loading">뽀득 전문가가 분석 중...</div></div>
			{/if}
			
			{#if step < 3}
			<div class="interactive-area fade-in">
				{#if step === 2}
					<div class="file-row">
						<label for="file-up">📸 현장 사진 첨부 (권장)</label>
						<input type="file" id="file-up" bind:this={imageInput} accept="image/*" />
					</div>
				{/if}
				<div class="input-row">
					<input type="text" bind:value={userInput} placeholder="메시지를 입력하세요..." on:keypress={(e) => e.key === 'Enter' && (step < 2 ? processFirstInput() : runAI())}/>
					<button on:click={() => (step < 2 ? processFirstInput() : runAI())} disabled={isLoading}>전송</button>
				</div>
			</div>
			{/if}
		</div>
	</div>

	{#if step === 3}
		<div class="result-modal fade-in">
			<div class="modal-content">
				<div class="res-body">{@html resultHtml}</div>
				<div class="btn-group">
					<button class="btn-down" on:click={downloadReport}>📄 리포트 저장(HTML)</button>
					<button class="btn-close" on:click={() => step = 2}>닫기</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	:global(body) { background: #f5f7f9; font-family: 'Pretendard', sans-serif; margin: 0; }
	.app { max-width: 480px; margin: 0 auto; background: #fff; height: 100vh; display: flex; flex-direction: column; position: relative; border-left: 1px solid #eee; border-right: 1px solid #eee; }
	header { padding: 15px; border-bottom: 1px solid #eee; text-align: center; background: #fff; }
	.brand { color: #1a73e8; font-weight: 800; font-size: 11px; letter-spacing: 1px; }
	h1 { font-size: 17px; margin: 5px 0 0; color: #333; }
	.chat-container { flex: 1; overflow-y: auto; padding: 15px; background: #f9f9f9; }
	.chat-window { display: flex; flex-direction: column; gap: 12px; }
	.msg { display: flex; flex-direction: column; }
	.msg.ai { align-items: flex-start; }
	.msg.user { align-items: flex-end; }
	.bubble { max-width: 85%; padding: 12px 16px; border-radius: 18px; font-size: 14px; line-height: 1.5; white-space: pre-wrap; box-shadow: 0 2px 4px rgba(0,0,0,0.03); }
	.msg.ai .bubble { background: #fff; color: #222; border-top-left-radius: 2px; }
	.msg.user .bubble { background: #1a73e8; color: #fff; border-top-right-radius: 2px; }
	.guide-text { margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ddd; font-size: 12px; color: #666; }
	.interactive-area { margin-top: 10px; }
	.input-row { display: flex; gap: 8px; }
	input { flex: 1; padding: 12px 18px; border: 1.5px solid #1a73e8; border-radius: 25px; outline: none; }
	button { background: #1a73e8; color: white; border: none; padding: 0 20px; border-radius: 25px; font-weight: bold; cursor: pointer; }
	.view-btn { margin-top: 10px; width: 100%; background: #34a853; font-size: 12px; }
	.file-row { margin-bottom: 8px; }
	.file-row label { font-size: 11px; color: #1a73e8; background: #e8f0fe; padding: 6px 12px; border-radius: 12px; cursor: pointer; display: inline-block; }
	.file-row input { display: none; }
	.result-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
	.modal-content { background: #fff; width: 100%; max-width: 400px; max-height: 85vh; border-radius: 25px; padding: 25px; display: flex; flex-direction: column; }
	.res-body { flex: 1; overflow-y: auto; font-size: 14px; line-height: 1.7; padding-right: 10px; }
	.btn-group { display: flex; gap: 10px; margin-top: 20px; }
	.btn-down { flex: 2; background: #34a853; }
	.btn-close { flex: 1; background: #333; }
	:global(.highlight-text) { color: #1a73e8; font-weight: bold; margin-bottom: 10px; display: block; }
	.loading { font-style: italic; color: #1a73e8; }
	.fade-in { animation: fadeIn 0.4s ease-out; }
	@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
</style>