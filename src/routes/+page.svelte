<script>
	import { onMount } from 'svelte';

	let GoogleGenerativeAI;
	let genAI;

	// 단계 관리: 1(대분류 버튼), 2(주제 직접 입력), 3(상세내용 가이드)
	let step = 1;
	let mainSelection = '';
	let subTopic = ''; // 사용자가 직접 입력한 주제
	let placeholderText = '상세한 상황을 입력해주세요.';
	let chatLog = [];

	let userQuestion = '';
	let resultHtml = '';
	let isLoading = false;
	let imageInput;

	// [1. 대분류 - 2x2 그리드용 구성]
	const mainOptions = [
		{ id: 'space', label: '🏠 청소 공간 유형', desc: '이사/거주/부분' },
		{ id: 'stain', label: '📍 세부 오염 처리', desc: '창틀, 주방, 욕실 등' },
		{ id: 'recycle', label: '♻️ 분리수거/배출', desc: '배출 원칙, 방법' },
		{ id: 'mind', label: '🧹 시작 마인드셋', desc: '동기부여, 루틴' }
	];

	// [2. 주제에 따른 동적 가이드 생성 로직]
	const getDynamicGuide = (topic) => {
		if (topic.includes('창틀') || topic.includes('베란다')) return "예: 창틀 하단 곰팡이가 심하고 외창에 찌든 먼지가 많습니다. 제거 가능한가요?";
		if (topic.includes('주방') || topic.includes('욕실') || topic.includes('후드')) return "예: 주방 후드 기름때가 딱딱하고, 욕실 타일 사이 변색이 심합니다.";
		if (topic.includes('이사') || topic.includes('입주')) return "예: 24평형 신축 아파트입니다. 공사 분진 가루가 집안 전체에 가득합니다.";
		if (topic.includes('바닥') || topic.includes('거실')) return "예: 강아지 소변 얼룩이 강화마루 사이사이에 배어있어 냄새가 납니다.";
		return `예: '${topic}' 관련하여 현재 상황(범위, 오염 정도 등)을 구체적으로 알려주시면 뽀득 전문가가 진단해 드립니다.`;
	};

	onMount(async () => {
		try {
			const module = await import('https://esm.run/@google/generative-ai');
			GoogleGenerativeAI = module.GoogleGenerativeAI;
			const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
			if (API_KEY) genAI = new GoogleGenerativeAI(API_KEY);
		} catch (e) { console.error("초기화 실패", e); }
	});

	function handleMainSelect(id) {
		mainSelection = id;
		let questionMsg = "";
		if (id === 'space') questionMsg = "청소 공간 유형에 대해 알려주세요. (예: 이사/입주 청소, 거주/부분 청소 등)";
		else if (id === 'stain') questionMsg = "집중 진단이 필요한 오염 구역에 대해 알려주세요. (예: 창틀 및 베란다, 주방 및 욕실, 바닥 오염 등)";
		else if (id === 'recycle') questionMsg = "문의하실 분리수거 품목이나 배출 상황을 알려주세요. (예: 가전 배출, 플라스틱 분류 등)";
		else questionMsg = "어떤 마인드셋이나 실천 요령이 궁금하신가요? (예: 청소 동기부여, 매일 10분 루틴 등)";

		chatLog = [{ role: 'ai', text: questionMsg }];
		step = 2;
	}

	function handleTopicSubmit() {
		if (!subTopic.trim()) {
			alert("주제를 입력해주세요.");
			return;
		}
		placeholderText = getDynamicGuide(subTopic);
		chatLog = [...chatLog, 
			{ role: 'user', text: subTopic },
			{ role: 'ai', text: `'${subTopic}'에 대한 상세 상황을 아래에 입력해주세요. 현장 사진을 첨부하시면 더 정확한 진단서가 발행됩니다.` }
		];
		step = 3;
	}

	async function runAI() {
		if (!genAI) return;
		isLoading = true;
		resultHtml = "뽀득 전문가 AI가 현장 데이터를 정밀 분석 중입니다...";

		try {
			const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
			const prompt = `[뽀득 전문가 모드]\n분류: ${subTopic}\n상세상황: ${userQuestion}\n[규칙] 15년 노하우를 담아 결함 체크리스트와 처방전을 전문적으로 작성할 것.`;
			
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
			resultHtml = `<strong>[뽀득 AI 진단서 발행]</strong><br><br>${result.response.text().replace(/\n/g, '<br>')}`;
		} catch (e) { resultHtml = "에러: " + e.message; }
		finally { isLoading = false; }
	}
</script>

<div class="app">
	<header>
		<div class="brand">BBODDEUK EXPERT</div>
		<h1>뽀득 AI 전문 진단</h1>
	</header>

	{#if step === 1}
		<div class="main-grid">
			{#each mainOptions as opt}
				<button class="menu-card" on:click={() => handleMainSelect(opt.id)}>
					<div class="card-content">
						<span class="icon">{opt.label.split(' ')[0]}</span>
						<strong>{opt.label.split(' ').slice(1).join(' ')}</strong>
						<p>{opt.desc}</p>
					</div>
				</button>
			{/each}
		</div>
	{:else}
		<div class="chat-container">
			{#each chatLog as chat}
				<div class="msg {chat.role}">
					<div class="bubble">{chat.text}</div>
				</div>
			{/each}

			{#if step === 2}
				<div class="input-row fade-in">
					<input type="text" bind:value={subTopic} placeholder="주제를 직접 입력하세요..." on:keypress={(e)=>e.key==='Enter' && handleTopicSubmit()}/>
					<button on:click={handleTopicSubmit}>확인</button>
				</div>
			{/if}

			{#if step === 3}
				<div class="final-box fade-in">
					<div class="field">
						<label>📸 현장 사진 (선택)</label>
						<input type="file" bind:this={imageInput} accept="image/*" />
					</div>
					<div class="field">
						<textarea bind:value={userQuestion} placeholder={placeholderText}></textarea>
					</div>
					<div class="btn-group">
						<button class="reset" on:click={()=>{step=1; subTopic=''; userQuestion=''; resultHtml='';}}>다시 시작</button>
						<button class="submit" on:click={runAI} disabled={isLoading}>
							{isLoading ? '진단 중...' : '뽀득 AI 진단 요청'}
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if resultHtml}
		<div class="result-box fade-in">{@html resultHtml}</div>
	{/if}
</div>

<style>
	:global(body) { background: #f4f7fa; font-family: 'Pretendard', sans-serif; padding: 20px; margin: 0; }
	.app { max-width: 500px; margin: 0 auto; background: #fff; border-radius: 30px; padding: 30px; box-shadow: 0 20px 50px rgba(0,0,0,0.05); }
	.brand { color: #1a73e8; font-weight: 800; font-size: 12px; letter-spacing: 1px; text-align: center; margin-bottom: 5px; }
	h1 { font-size: 22px; text-align: center; margin: 0 0 30px 0; color: #222; }

	/* 2행 2열 그리드 */
	.main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
	.menu-card { background: #fff; border: 1.5px solid #eee; border-radius: 20px; padding: 20px 10px; cursor: pointer; transition: 0.2s; }
	.menu-card:hover { border-color: #1a73e8; background: #f8fbff; transform: translateY(-3px); }
	.icon { font-size: 28px; display: block; margin-bottom: 10px; }
	.menu-card strong { display: block; font-size: 15px; color: #333; margin-bottom: 5px; }
	.menu-card p { font-size: 11px; color: #999; margin: 0; line-height: 1.3; }

	/* 채팅 스타일 */
	.chat-container { display: flex; flex-direction: column; gap: 15px; }
	.msg { display: flex; flex-direction: column; }
	.msg.ai { align-items: flex-start; }
	.msg.user { align-items: flex-end; }
	.bubble { max-width: 85%; padding: 14px 18px; border-radius: 20px; font-size: 14px; line-height: 1.5; }
	.msg.ai .bubble { background: #f1f3f4; color: #333; border-top-left-radius: 2px; }
	.msg.user .bubble { background: #1a73e8; color: #fff; border-top-right-radius: 2px; }

	/* 입력창 */
	.input-row { display: flex; gap: 10px; }
	.input-row input { flex: 1; padding: 14px; border: 1.5px solid #ddd; border-radius: 15px; outline: none; font-size: 14px; }
	.input-row button { background: #1a73e8; color: white; border: none; padding: 0 20px; border-radius: 15px; font-weight: bold; cursor: pointer; }

	.final-box { background: #f8f9fa; padding: 20px; border-radius: 20px; margin-top: 10px; }
	.field { margin-bottom: 15px; }
	.field label { font-size: 12px; font-weight: bold; color: #666; display: block; margin-bottom: 8px; }
	textarea { width: 100%; height: 120px; border: 1.5px solid #ddd; border-radius: 15px; padding: 15px; box-sizing: border-box; resize: none; font-size: 14px; outline: none; }
	
	.btn-group { display: flex; gap: 10px; }
	.submit { flex: 3; background: #1a73e8; color: #fff; border: none; padding: 16px; border-radius: 15px; font-weight: bold; cursor: pointer; }
	.reset { flex: 1; background: #fff; border: 1px solid #ddd; border-radius: 15px; cursor: pointer; font-size: 12px; }

	.result-box { margin-top: 30px; background: #fcfdfe; border: 1px solid #eef2f6; border-radius: 20px; padding: 25px; font-size: 14px; line-height: 1.8; }
	.fade-in { animation: fadeIn 0.4s ease-out; }
	@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>