<script>
	import { onMount } from 'svelte';
	//import { GoogleGenerativeAI } from '@google/generative-ai';

	let GoogleGenerativeAI;
	let genAI; // = new GoogleGenerativeAI(API_KEY);

	let selectedHelper = '';
	let mainCategory = '';
	let subCategory = '';
	let userQuestion = '';
	let resultText = '선택하신 분야에 따라 맞춤형 조언이 여기에 나타납니다.';
	let isLoading = false;
	let imageInput;
	let responseHistory = [];

	onMount(async () => {
		// npm 패키지 대신 CDN을 통해 직접 로드합니다.
		const module = await import('https://esm.run/@google/generative-ai');
		GoogleGenerativeAI = module.GoogleGenerativeAI;

		// 2. 키를 onMount 시점에 직접 가져옵니다 (지연 로딩 대응)
		const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

		if (!API_KEY) {
			console.error('API 키를 찾을 수 없습니다. Envs 설정을 확인하세요.');
			resultText = '에러: API 키 설정이 누락되었습니다.';
			return;
		}
		genAI = new GoogleGenerativeAI(API_KEY);
		console.log('AI 라이브러리 로드 성공');
	});

	const categoryData = {
		mindset: {
			subs: [
				'마인드셋: 시작이 어려운 당신에게',
				'실천 요령: 조금씩 꾸준히',
				'봉투 선택 및 배출 기본'
			],
			guide: '💡 청소에 대한 부담을 덜어주는 마인드와 기초 정보를 제공합니다.',
			placeholder: '청소가 늘 어려워요. 방에 쌓인 쓰레기 양이 많고 종류가 다양해요.',
			photoReq: false
		},
		strategy: {
			subs: ['전반적 청소 전략 (방 전체)', '구역별 집중 요령 (특정 지점)'],
			guide: '💡 사진을 올리면 AI가 공간을 분석해 최적의 청소 순서를 설계합니다.',
			placeholder: '이 방을 가장 효율적으로 청소하려면 어느 구석부터 손대야 할까요?',
			photoReq: true
		},
		recycle: {
			subs: ['일반 분리수거 원칙', '품목별 상세 배출법', '쓰레기 봉투 사진 진단'],
			guide: '💡 헷갈리는 품목을 물어보거나, 모아둔 쓰레기 봉투 사진을 찍어주세요.',
			placeholder: '플라스틱 배달 용기, 빨간 국물 자국이 있는데 그냥 버려도 되나요?',
			photoReq: false
		}
	};

	// 라디오 버튼 선택 시 자동 설정 로직
	$: if (selectedHelper) {
		if (selectedHelper === 'stepByStep') {
			mainCategory = 'mindset';
			// 중분류는 대분류가 확정된 후 categoryData를 참조하므로 약간의 텀을 주거나 직접 할당
			subCategory = '실천 요령: 조금씩 꾸준히';
		} else if (selectedHelper === 'spotCleaning') {
			mainCategory = 'strategy';
			subCategory = '구역별 집중 요령 (특정 지점)';
		} else if (selectedHelper === 'recycleGuide') {
			mainCategory = 'recycle';
			subCategory = '일반 분리수거 원칙';
		} else if (selectedHelper === 'totalConsulting') {
			mainCategory = 'strategy'; // 컨설팅은 전략으로 기본 설정
			subCategory = '전반적 청소 전략 (방 전체)';
		}
	}

	async function fileToGenerativePart(file) {
		const base64 = await new Promise((r) => {
			const reader = new FileReader();
			reader.onloadend = () => r(reader.result.split(',')[1]);
			reader.readAsDataURL(file);
		});
		return { inlineData: { data: base64, mimeType: file.type } };
	}

	async function runAI() {
		if (!mainCategory) return alert('분야를 선택해주세요.');
		isLoading = true;
		resultText = 'AI 도우미가 분석을 시작합니다...';

		try {
			const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

			// [1. 핵심 지침 복구] AI의 정체성과 서식을 강하게 규정합니다.
			const styleInstruction = `
[필수 역할] 당신은 15년 경력의 베테랑 '청소 및 정리 전문가'입니다. 
모든 답변은 오직 '청소, 정리, 분리수거'와 관련된 관점에서만 답변해야 합니다. 
만약 사용자가 청소와 관련 없는 질문(예: 외국어 공부, 요리 등)을 하면, "저는 청소 전문가로서 해당 분야는 잘 모르지만, 청소와 관련된 질문을 주시면 최선을 다해 돕겠습니다."라고 정중히 거절한 뒤, 질문을 청소 상황에 빗대어 조언하세요.

[답변 규칙]
- 별표(**) 기호를 절대 사용하지 마세요.
- 중요한 항목은 대괄호 [ ]를 사용하세요.
- 문단 사이에는 충분한 줄바꿈을 넣어주세요.
`;

			// [2. 상황별 프롬프트 구성]
			let prompt = `${styleInstruction}\n\n현재 전문가 모드: [${mainCategory} - ${subCategory}].\n`;

			if (imageInput.files[0]) {
				prompt += `[상황] 사용자가 사진을 업로드했습니다. 사진 속의 오염도, 물건의 배치, 쓰레기 종류를 정밀 분석하여 단계별 청소 전략을 세워주세요. `;
			} else {
				prompt += `[상황] 사진이 없으므로 사용자의 질문에 기반하여 일반적인 청소 노하우를 제공하세요. `;
			}

			prompt += `\n사용자 질문: "${userQuestion}"`;

			let parts = [prompt];
			if (imageInput.files[0]) {
				parts.push(await fileToGenerativePart(imageInput.files[0]));
			}

			const result = await model.generateContent(parts);
			resultText = result.response.text().replace(/\*\*/g, '');

			responseHistory = [
				...responseHistory,
				{ date: new Date().toLocaleTimeString(), q: userQuestion, a: resultText }
			];
		} catch (e) {
			resultText = '에러 발생: ' + e.message;
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="container">
	<header>
		<h1>🧹 청소 토탈 도우미</h1>
		<p class="subtitle">개인별 맞춤 전략 & 분리수거 컨설팅</p>
	</header>

	<section class="helper-area">
		<label>🎯 어떤 방식을 원하세요?</label>
		<div class="radio-group">
			{#each ['stepByStep', 'spotCleaning', 'recycleGuide', 'totalConsulting'] as val}
				<label class:active={selectedHelper === val}>
					<input type="radio" name="helper" value={val} bind:group={selectedHelper} />
					{val === 'stepByStep'
						? '스스로 점진적 실천'
						: val === 'spotCleaning'
							? '공간별 요령'
							: val === 'recycleGuide'
								? '분리수거 요령'
								: '전반적 컨설팅'}
				</label>
			{/each}
		</div>
	</section>

	{#if selectedHelper}
		<section class="selection-area" class:active={selectedHelper}>
			<label>📁 상세 분야 설정</label>
			<select bind:value={mainCategory}>
				<option value="">대분류 선택</option>
				<option value="mindset">마인드 및 기본 요령</option>
				<option value="strategy">공간별 청소 전략</option>
				<option value="recycle">분리수거 방법</option>
			</select>

			{#if mainCategory && categoryData[mainCategory]}
				<div class="guide-box">{categoryData[mainCategory].guide}</div>
				<select bind:value={subCategory}>
					{#each categoryData[mainCategory].subs as sub}
						<option value={sub}>{sub}</option>
					{/each}
				</select>
			{/if}
		</section>
	{/if}

	<section class="upload-area">
		<label for="imageInput">📸 사진 업로드 (선택)</label>
		<input type="file" id="imageInput" bind:this={imageInput} accept="image/*" />

		<textarea bind:value={userQuestion} placeholder="무엇을 도와드릴까요?"></textarea>
	</section>

	<button on:click={runAI} class="main-btn" disabled={isLoading}>
		{isLoading ? '분석 중...' : 'AI 분석 및 조언 받기'}
	</button>

	<div class="result-box">
		<div class="result-header">분석 결과</div>
		<div id="result">{resultText}</div>
	</div>
</div>

<style>
	/* ============================================================
   [1] GLOBAL STYLES & LAYOUT
   기본 폰트 설정, 배경색, 전체 레이아웃의 중앙 정렬을 담당합니다.
   ============================================================ */
	body {
		background-color: #f8f9fa;
		font-family:
			'Pretendard',
			-apple-system,
			sans-serif;
		color: #333;
		display: flex;
		justify-content: center;
		padding: 20px;
		margin: 0;
	}

	.container {
		background: #ffffff;
		width: 95%;
		max-width: 900px; /* PC 환경 가독성을 위한 폭 확대 */
		padding: 40px;
		border-radius: 24px;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
	}

	.hidden {
		display: none !important;
	}

	/* ============================================================
   [2] TYPOGRAPHY & HEADER
   제목(h1)과 부제목의 스타일 및 텍스트 정렬을 관리합니다.
   ============================================================ */
	h1 {
		color: #1a73e8;
		font-size: 22px;
		margin: 0 0 8px 0;
		text-align: center;
	}
	.subtitle {
		color: #70757a;
		text-align: center;
		margin-bottom: 25px;
		font-size: 14px;
	}

	/* ============================================================
   [3] HELPER AREA (RADIO BUTTONS)
   '어떤 방식을 원하세요?' 질문 섹션과 라디오 버튼 디자인입니다.
   ============================================================ */
	.helper-area {
		background: #fdfdfd;
		border: 1px solid #eee;
		padding: 20px;
		border-radius: 15px;
		margin-bottom: 25px;
	}

	.radio-group {
		display: grid;
		grid-template-columns: repeat(2, 1fr); /* 2열 배치 */
		gap: 12px;
		margin-top: 15px;
	}

	.radio-group label {
		font-weight: normal;
		font-size: 14px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px;
		background: white;
		border: 2px solid #eee;
		border-radius: 10px;
		transition: all 0.2s;
	}

	.radio-group label:hover {
		background: #f0f7ff;
		border-color: #1a73e8;
	}

	/* 라디오 버튼 선택 시 하이라이트 효과 */
	.radio-group label:has(input:checked) {
		background: #eef4ff;
		border-color: #1a73e8;
	}

	.radio-group input[type='radio'] {
		width: 18px;
		height: 18px;
		accent-color: #1a73e8;
	}

	/* ============================================================
   [4] SELECTION AREA (DYNAMIC)
   대분류/중분류 드롭다운 섹션입니다. 선택 도우미 클릭 시 활성화됩니다.
   ============================================================ */
	.selection-area {
		max-height: 0;
		overflow: hidden;
		opacity: 0;
		transition: all 0.5s ease-in-out;
		margin-top: 0;
	}

	/* 라디오 선택 시 JS를 통해 추가되는 클래스 */
	.selection-area.active {
		max-height: 500px;
		opacity: 1;
		margin-top: 20px;
		padding-bottom: 20px;
	}

	.input-group {
		margin-bottom: 18px;
	}
	label {
		display: block;
		font-weight: 600;
		margin-bottom: 8px;
		font-size: 14px;
		color: #444;
	}

	select,
	textarea {
		width: 100%;
		padding: 12px;
		border: 1.5px solid #e0e0e0;
		border-radius: 10px;
		font-size: 14px;
		transition: border-color 0.2s;
		box-sizing: border-box;
	}

	select:focus,
	textarea:focus {
		border-color: #1a73e8;
		outline: none;
	}

	/* ============================================================
   [5] GUIDE & HINT MESSAGES
   카테고리별 안내문구와 사진 업로드 힌트 메시지 스타일입니다.
   ============================================================ */
	.guide-box {
		background: #f1f7fe;
		padding: 12px 15px;
		border-radius: 10px;
		font-size: 13px;
		color: #1967d2;
		margin-bottom: 20px;
		border: 1px solid #d2e3fc;
	}

	.hint-text {
		font-size: 12px;
		color: #666;
		margin-top: 6px;
	}

	#imageHint {
		font-size: 13px;
		color: #1a73e8;
		background: #eef4ff;
		padding: 8px 12px;
		border-radius: 8px;
		display: inline-block;
		margin-top: 10px;
	}

	/* ============================================================
   [6] BUTTONS & ACTIONS
   메인 분석 버튼 및 하단 리포트/문의 버튼 그룹 디자인입니다.
   ============================================================ */
	button {
		width: 100%;
		border: none;
		padding: 14px;
		border-radius: 12px;
		font-size: 15px;
		font-weight: 700;
		cursor: pointer;
		transition:
			transform 0.1s,
			opacity 0.2s;
	}

	button:active {
		transform: scale(0.98);
	}

	.main-btn {
		background-color: #1a73e8;
		color: white;
		margin-top: 10px;
	}
	.action-group {
		display: flex;
		gap: 8px;
		margin-top: 15px;
	}
	.sub-btn {
		background-color: #f1f3f4;
		color: #3c4043;
	}
	.accent-btn {
		background-color: #e6f4ea;
		color: #137333;
	}

	/* ============================================================
   [7] RESULT DISPLAY
   AI 분석 결과창, 로딩 애니메이션 텍스트 스타일입니다.
   ============================================================ */
	.result-box {
		margin-top: 25px;
		background: #ffffff;
		border: 1px solid #e0e0e0;
		border-radius: 12px;
		overflow: hidden;
	}

	.result-header {
		background: #f8f9fa;
		padding: 10px 15px;
		border-bottom: 1px solid #e0e0e0;
		font-size: 13px;
		font-weight: bold;
		color: #5f6368;
	}

	#result {
		padding: 25px; /* 넓어진 폭에 맞춰 패딩 확대 */
		font-size: 15px;
		line-height: 1.8; /* 별표 없이도 읽기 편한 간격 */
		min-height: 100px;
		white-space: pre-wrap;
		word-break: break-all;
	}

	#loading {
		text-align: center;
		padding: 15px;
		color: #1a73e8;
		font-size: 13px;
		font-weight: 500;
	}

	/* ====================
	
	========================================
   [8] RESPONSIVE MEDIA QUERIES
   모바일 등 작은 화면에서의 레이아웃 조정을 처리합니다.
   ============================================================ */
	@media (max-width: 600px) {
		.radio-group {
			grid-template-columns: 1fr; /* 모바일은 1열 */
		}
		.container {
			padding: 20px;
		}
	}
</style>
