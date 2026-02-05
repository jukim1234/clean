<script>
	import { onMount } from 'svelte';

	let GoogleGenerativeAI;
	let genAI;

	let step = 1;
	let mainSelection = '';
	let subSelection = '';

	let userQuestion = '';
	let resultHtml = '선택하신 분야에 따라 맞춤형 조언이 여기에 나타납니다.';
	let isLoading = false;
	let imageInput;
	let responseHistory = [];
	let currentAiResponse = '';
	let currentReportId = ''; // 상담 관리 번호 저장용

	const mainOptions = [
		{ id: 'basic', label: '🧹 청소 시작/마인드셋' },
		{ id: 'strategy', label: '📍 구역별 청소 전략' },
		{ id: 'recycle', label: '♻️ 분리수거/배출 방법' },
		{ id: 'etc', label: '❓ 기타 일반 문의' }
	];

	const subOptions = {
		basic: [
			'마인드셋: 시작이 어려운 당신에게',
			'실천 요령: 조금씩 꾸준히',
			'봉투 선택 및 배출 기본'
		],
		strategy: ['전반적 청소 전략 (방 전체)', '구역별 집중 요령 (특정 지점)'],
		recycle: ['일반 분리수거 원칙', '품목별 상세 배출법', '쓰레기 봉투 사진 진단']
	};

	onMount(async () => {
		const module = await import('https://esm.run/@google/generative-ai');
		GoogleGenerativeAI = module.GoogleGenerativeAI;
		const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

		if (!API_KEY) {
			resultHtml = '에러: API 키 설정이 누락되었습니다.';
			return;
		}
		genAI = new GoogleGenerativeAI(API_KEY);
	});

	function handleMainSelect(id) {
		mainSelection = id;
		if (id === 'etc') {
			subSelection = '기타 일반 문의';
			step = 3;
		} else {
			step = 2;
		}
	}

	function handleSubSelect(sub) {
		subSelection = sub;
		step = 3;
	}

	function goBack() {
		if (step === 3 && mainSelection === 'etc') step = 1;
		else if (step === 3) step = 2;
		else if (step === 2) step = 1;
	}

	async function fileToGenerativePart(file) {
		const base64 = await new Promise((r) => {
			const reader = new FileReader();
			reader.onloadend = () => r(reader.result.split(',')[1]);
			reader.readAsDataURL(file);
		});
		return { inlineData: { data: base64, mimeType: file.type } };
	}

	// 관리 번호 생성 함수 (YYMMDD-순번/난수)
	function generateReportId() {
		const now = new Date();
		const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
		const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
		return `${dateStr}-${randomStr}`;
	}

	async function runAI() {
		isLoading = true;
		const currentQuestion = userQuestion.trim() || `${subSelection} 핵심 가이드 요청`;
		resultHtml = '전문가가 최적의 가이드를 구성하고 있습니다...';
		currentReportId = generateReportId();

		try {
			const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
			const recentHistory = responseHistory.slice(-2);
			let contextString =
				recentHistory.length > 0
					? '[이전 대화]\n' + recentHistory.map((h) => `Q: ${h.q}\nA: ${h.a}`).join('\n') + '\n\n'
					: '';

			const styleInstruction = `[역할] 15년 경력 청소 전문가.\n[규칙]\n1. 자기소개나 인사말 절대 금지.\n2. 3~5개 항목 이내 간결 핵심 전달.\n3. 전문적이며 실행 가능한 내용.\n4. 답변 마지막에 반드시 [작업자 현장 체크 리스트]라는 머리말과 함께 현장에서 확인해야 할 결함이나 주의사항을 2~3줄로 요약해 주세요.\n분야: [${mainSelection} - ${subSelection}].`;

			let prompt = `${styleInstruction}\n\n${contextString}${userQuestion.trim() ? `질문: "${userQuestion}"` : `핵심 노하우 요약 요청`}`;

			let parts = [prompt];
			if (imageInput.files[0]) {
				parts.push(await fileToGenerativePart(imageInput.files[0]));
			}

			const result = await model.generateContent(parts);
			currentAiResponse = result.response.text().replace(/\*\*/g, '');

			const fixedHeader = `<span class="highlight-text">답변은 직접 청소에 참고하셔도 좋고, 본 상담 다음에 아래의 내용을 그대로 덧붙여 견적을 위한 상담 문의 주시면 다시 상세한 답변을 드리겠습니다.</span>\n`;
			const reportIdLine = `<span style="font-size: 12px; color: #888;">상담 관리 번호: ${currentReportId}</span>\n`;

			resultHtml =
				fixedHeader +
				reportIdLine +
				`--------------------\n[일차 '참고 상담' 내용]\nQ: ${currentQuestion}\n\n` +
				currentAiResponse;

			responseHistory = [...responseHistory, { q: currentQuestion, a: currentAiResponse }];
		} catch (e) {
			resultHtml = '에러 발생: ' + e.message;
		} finally {
			isLoading = false;
		}
	}

	async function downloadReport() {
		const date = new Date().toLocaleString();
		let imgTag = '';

		if (imageInput.files[0]) {
			const base64 = await new Promise((r) => {
				const reader = new FileReader();
				reader.onload = () => r(reader.result);
				reader.readAsDataURL(imageInput.files[0]);
			});
			imgTag = `<div class="section-title">첨부 현장 사진</div><img src="${base64}" style="max-width:100%; border-radius:10px; margin-bottom:20px; border:1px solid #eee;">`;
		}

		const reportHtml = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>청소 사전 진단 보고서</title>
	<style>
		body { font-family: 'Pretendard', -apple-system, sans-serif; line-height: 1.6; color: #333; padding: 40px; background: #f5f5f5; }
		.paper { background: #fff; padding: 60px; max-width: 800px; margin: 0 auto; box-shadow: 0 0 20px rgba(0,0,0,0.1); border-top: 8px solid #1a73e8; }
		.header { border-bottom: 2px solid #1a73e8; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
		.title { font-size: 28px; font-weight: 800; color: #1a73e8; margin: 0; }
		.info { font-size: 14px; color: #666; text-align: right; }
		.section-title { font-size: 18px; font-weight: 700; margin: 30px 0 15px; padding-left: 10px; border-left: 4px solid #1a73e8; background: #f8f9ff; padding-top: 5px; padding-bottom: 5px; }
		.content { background: #fff; padding: 10px 5px; white-space: pre-wrap; font-size: 16px; }
		.footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee; font-size: 13px; color: #888; text-align: center; }
		table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
		table th, table td { border: 1px solid #eee; padding: 12px; text-align: left; font-size: 14px; }
		table th { background: #fcfcfc; color: #666; width: 30%; }
	</style>
</head>
<body>
	<div class="paper">
		<div class="header">
			<h1 class="title">AI 청소 사전 진단서</h1>
			<div class="info">관리 번호: ${currentReportId}<br>진단 일시: ${date}</div>
		</div>
		<table>
			<tr><th>진단 분류</th><td>${mainSelection} > ${subSelection}</td></tr>
			<tr><th>업체 정보</th><td>서비스 파트너: 뽀득(Bboddeuk)</td></tr>
		</table>
		<div class="section-title">고객 문의 및 요청사항</div>
		<div class="content">${userQuestion || subSelection + ' 관련 가이드 요청'}</div>
		${imgTag}
		<div class="section-title">전문가 진단 및 솔루션 (현장 체크리스트 포함)</div>
		<div class="content" style="background:#f0f4f8; padding:25px; border-radius:10px; color:#1a3a5f;">${currentAiResponse}</div>
		<div class="footer">본 보고서의 관리 번호를 업체에 제시하시면 더 빠른 견적 상담이 가능합니다.</div>
	</div>
</body>
</html>`;

		const blob = new Blob([reportHtml], { type: 'text/html' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `청소진단보고서_${currentReportId}.html`;
		a.click();
	}
</script>

<div class="container">
	<header>
		<h1>🧹 청소 토탈 도우미</h1>
		<p class="subtitle">개인별 맞춤 전략 & 분리수거 컨설팅</p>
	</header>

	{#if step === 1}
		<section class="selection-step">
			<label>🎯 어떤 분야의 도움이 필요하신가요?</label>
			<p class="guide-text">
				가장 고민되는 분야를 선택해 주세요. 15년 경력 전문가 비서가 최적의 솔루션을 구성합니다.
			</p>
			<div class="button-grid">
				{#each mainOptions as opt}
					<button class="opt-btn" on:click={() => handleMainSelect(opt.id)}>
						{opt.label}
					</button>
				{/each}
			</div>
		</section>
	{:else if step === 2}
		<section class="selection-step">
			<div class="step-header">
				<button class="back-link" on:click={goBack}>← 이전으로</button>
				<span class="selected-badge">{mainOptions.find((o) => o.id === mainSelection).label}</span>
			</div>
			<label>📁 더 구체적인 항목을 선택해 주세요.</label>
			<p class="guide-text">구역을 정해주시면 맞춤형 장비와 세제 처방을 미리 준비해 드립니다.</p>
			<div class="button-grid secondary">
				{#each subOptions[mainSelection] as sub}
					<button class="opt-btn sub-btn" on:click={() => handleSubSelect(sub)}>
						{sub}
					</button>
				{/each}
			</div>
		</section>
	{:else}
		<section class="input-step">
			<div class="step-header">
				<button class="back-link" on:click={goBack}>← 이전으로</button>
				<span class="selected-badge">{subSelection}</span>
			</div>

			<div class="upload-area">
				<label for="imageInput">📸 현장 사진 업로드 (권장)</label>
				<p class="guide-text" style="margin-top: 5px;">
					오염 부위를 가깝게 한 장 찍어주시면 사장님의 정확한 견적 산출에 큰 도움이 됩니다.
				</p>
				<input type="file" id="imageInput" bind:this={imageInput} accept="image/*" />
				<textarea
					bind:value={userQuestion}
					placeholder="예: 3년 된 벽지 곰팡이인데 일반 청소로 지워질까요? 구체적일수록 정확한 조언이 가능합니다."
				></textarea>
			</div>

			<button on:click={runAI} class="main-btn" disabled={isLoading}>
				{isLoading ? '현장 분석 및 솔루션 구성 중...' : '전문가 진단 및 리포트 생성'}
			</button>
		</section>
	{/if}

	{#if responseHistory.length > 0}
		<div class="result-box">
			<div class="result-header">
				<span>전문가 핵심 조언 및 현장 체크리스트</span>
				<button class="download-btn" on:click={downloadReport}>📄 리포트 저장</button>
			</div>
			<div id="result">{@html resultHtml}</div>
		</div>
	{/if}
</div>

<style>
	body {
		background-color: #f8f9fa;
		font-family: 'Pretendard', sans-serif;
		padding: 20px;
		margin: 0;
		display: flex;
		justify-content: center;
	}
	.container {
		background: #fff;
		width: 95%;
		max-width: 700px;
		padding: 35px;
		border-radius: 24px;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
	}
	h1 {
		color: #1a73e8;
		font-size: 22px;
		text-align: center;
		margin: 0 0 8px 0;
	}
	.subtitle {
		color: #70757a;
		text-align: center;
		margin-bottom: 30px;
		font-size: 14px;
	}
	.guide-text {
		font-size: 13px;
		color: #666;
		margin-bottom: 10px;
		line-height: 1.4;
	}
	.button-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 15px;
		margin-top: 10px;
	}
	.button-grid.secondary {
		grid-template-columns: 1fr;
	}
	.opt-btn {
		padding: 25px 15px;
		background: #fff;
		border: 1.5px solid #eee;
		border-radius: 15px;
		cursor: pointer;
		transition: all 0.2s;
		font-weight: 600;
		font-size: 14px;
		text-align: center;
	}
	.opt-btn:hover {
		background: #f1f7fe;
		border-color: #1a73e8;
		color: #1a73e8;
	}
	.sub-btn {
		padding: 18px;
		text-align: left;
		border-left: 5px solid #1a73e8;
		background: #fcfdfe;
	}
	.step-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 25px;
	}
	.back-link {
		background: none;
		border: none;
		color: #1a73e8;
		cursor: pointer;
		font-size: 13px;
		font-weight: bold;
	}
	.selected-badge {
		background: #eef4ff;
		color: #1a73e8;
		padding: 6px 15px;
		border-radius: 20px;
		font-size: 12px;
		font-weight: bold;
	}
	textarea {
		width: 100%;
		min-height: 200px;
		padding: 15px;
		border: 1.5px solid #e0e0e0;
		border-radius: 12px;
		font-size: 15px;
		line-height: 1.6;
		box-sizing: border-box;
		margin-top: 10px;
		resize: none;
		outline: none;
	}
	.main-btn {
		width: 100%;
		padding: 18px;
		background: #1a73e8;
		color: #fff;
		border: none;
		border-radius: 12px;
		font-weight: 700;
		cursor: pointer;
		margin-top: 20px;
	}
	.main-btn:disabled {
		background: #ccc;
	}
	.result-box {
		margin-top: 30px;
		border: 1px solid #e0e0e0;
		border-radius: 12px;
		overflow: hidden;
		background: #fff;
	}
	.result-header {
		background: #f8f9fa;
		padding: 12px 15px;
		border-bottom: 1px solid #e0e0e0;
		font-size: 13px;
		font-weight: bold;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	#result {
		padding: 25px;
		font-size: 15px;
		line-height: 1.8;
		white-space: pre-wrap;
		color: #333;
	}
	:global(.highlight-text) {
		color: #1e4620;
		font-weight: 800;
		display: block;
		margin-bottom: 8px;
	}
	.download-btn {
		background: #34a853;
		color: white;
		border: none;
		padding: 6px 14px;
		border-radius: 6px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 600;
	}
	.download-btn:hover {
		background: #2d9147;
	}
</style>
