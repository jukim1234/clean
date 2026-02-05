<script>
	/**
	 [ 뽀득 AI 전문 진단 시스템: 사장님의 설계 철학 ]
	 * 1. "메뉴판만 보고 나가는 건 싫어요" (보안과 몰입)
	 - 처음엔 큼직하게 4개 카테고리만 보여줘서 뽀득이 뭘 잘하는지 딱 보여줍니다.
	 - 하지만 그 다음부턴 버튼 클릭이 아니라, 고객이 직접 자기 사연을 적게 만들었어요.
	 - 이렇게 하면 경쟁사들이 우리 로직을 훔쳐보기도 어렵고, 고객은 진짜 상담받는 기분이 듭니다.
	 * 2. "고객이 무슨 말을 할지 미리 알고 대답하기" (맥락 파악)
	 - 고객이 '창틀'이라고만 써도, 우리 AI는 "아, 곰팡이 때문에 고민이시구나" 하고 눈치를 챕니다.
	 - 그래서 다음 질문창에 "창틀 곰팡이 상태는 어떤가요?" 같은 맞춤형 가이드(Placeholder)를 띄워주죠.
	 * 3. "번호 누르는 건 기계 같잖아요" (대화형 인터페이스)
	 - 1번, 2번 버튼 누르는 대신 "이사 가시는 건지, 살면서 청소하시는 건지" 직접 단어로 입력받게 했습니다.
	 - 예시에 없는 특이한 상황(예: 벽지 니코틴)을 입력해도 AI가 다 알아듣고 대응합니다.
	 * 4. "한눈에 들어오는 깔끔한 첫인상" (2x2 그리드)
	 - 첫 화면은 스마트폰에서 보기 편하게 2개씩 짝지어서 2행으로 딱 맞췄습니다.
	 - 뽀득의 4대 핵심 서비스(공간유형, 오염처리, 분리수거, 마인드셋)가 한눈에 들어옵니다.
	 * 5. "결국 중요한 건 전문가의 처방전" (리포트 발행)
	 - 대화가 끝나면 사장님의 15년 노하우가 담긴 '진단서'가 나옵니다.
	 - 사진까지 분석해서 작업자가 현장에서 꼭 봐야 할 체크리스트까지 뽑아주는 아주 똑똑한 녀석입니다.
	 */

	import { onMount } from 'svelte';

	let GoogleGenerativeAI;
	let genAI;

	let step = 1; 
	let mainSelection = '';
	let subTopic = ''; 
	let placeholderText = '상세한 상황을 입력해주세요.';
	let chatLog = [];

	let userQuestion = '';
	let resultHtml = '';
	let isLoading = false;
	let imageInput;

	const mainOptions = [
		{ id: 'space', label: '🏠 청소 공간 유형', desc: '이사/거주/부분' },
		{ id: 'stain', label: '📍 세부 오염 처리', desc: '창틀, 주방, 욕실 등' },
		{ id: 'recycle', label: '♻️ 분리수거/배출', desc: '배출 원칙, 방법' },
		{ id: 'mind', label: '🧹 시작 마인드셋', desc: '동기부여, 루틴' }
	];

	const getDynamicGuide = (topic) => {
		const t = topic.toLowerCase();
		if (t.includes('창틀') || t.includes('베란다')) return "예: 창틀 하단 곰팡이가 심하고 외창에 찌든 먼지가 많습니다. 제거 가능한가요?";
		if (t.includes('주방') || t.includes('욕실') || t.includes('후드')) return "예: 주방 후드 기름때가 딱딱하고, 욕실 타일 사이 변색이 심합니다.";
		if (t.includes('이사') || t.includes('입주')) return "예: 24평형 신축 아파트 입주 예정입니다. 공사 분진 가루가 집안 전체에 가득합니다.";
		if (t.includes('거주') || t.includes('부분') || t.includes('전체')) return "예: 거주 중인 집의 거실 바닥에 반려동물 얼룩과 냄새가 배어있어 특수 세척이 필요합니다.";
		return `예: '${topic}' 관련하여 현재 상황(범위, 오염 정도 등)을 구체적으로 알려주시면 뽀득 전문가가 진단해 드립니다.`;
	};

	onMount(async () => {
		try {
			const module = await import('https://esm.run/@google/generative-ai');
			GoogleGenerativeAI = module.GoogleGenerativeAI;
			const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
			if (API_KEY) genAI = new GoogleGenerativeAI(API_KEY);
		} catch (e) { console.error("API 로드 실패", e); }
	});

	function handleMainSelect(id) {
		mainSelection = id;
		let questionMsg = "";
		
		if (id === 'space') {
			questionMsg = "청소 공간 유형에 대해 알려주세요. (예: 거주 공간 일부/전체, 일반 이사, 업체 입주 등)";
		} else if (id === 'stain') {
			questionMsg = "집중 진단이 필요한 오염 구역에 대해 알려주세요. (예: 창틀 및 베란다, 주방 및 욕실, 바닥 오염 등)";
		} else if (id === 'recycle') {
			questionMsg = "문의하실 분리수거 품목이나 배출 상황을 알려주세요. (예: 가전 배출, 플라스틱 분류 등)";
		} else {
			questionMsg = "어떤 마인드셋이나 실천 요령이 궁금하신가요? (예: 청소 동기부여, 매일 10분 루틴 등)";
		}

		chatLog = [{ role: 'ai', text: questionMsg }];
		step = 2;
	}

	function handleTopicSubmit() {
		if (!subTopic.trim()) {
			alert("상담 주제를 입력해주세요.");
			return;
		}
		placeholderText = getDynamicGuide(subTopic);
		chatLog = [...chatLog, 
			{ role: 'user', text: subTopic },
			{ role: 'ai', text: `'${subTopic}'(이)라고 말씀하셨군요. 전문가가 더 정확히 진단할 수 있게 상세 상황을 아래에 적어주세요.` }
		];
		step = 3;
	}

	async function runAI() {
		if (!genAI) return;
		isLoading = true;
		resultHtml = "뽀득 전문가 AI가 리포트를 작성 중입니다. 잠시만 기다려주세요...";

		try {
			const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
			const prompt = `[뽀득 전문가 모드]\n주제: ${subTopic}\n상황: ${userQuestion}\n[미션] 15년 경력 노하우를 담아 친절하면서도 전문적인 결함 체크리스트와 처방전을 작성할 것.`;
			
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
		} catch (e) { resultHtml = "진단 도중 문제가 생겼어요: " + e.message; }
		finally { isLoading = false; }
	}
</script>

<div class="app">
	<header>
		<div class="brand">BBODDEUK AI</div>
		<h1>전문가 상담 서비스</h1>
	</header>

	{#if step === 1}
		<div class="main-grid">
			{#each mainOptions as opt}
				<button class="menu-card" on:click={() => handleMainSelect(opt.id)}>
					<span class="icon">{opt.label.split(' ')[0]}</span>
					<strong>{opt.label.split(' ').slice(1).join(' ')}</strong>
					<p>{opt.desc}</p>
				</button>
			{/each}
		</div>
	{:else}
		<div class="chat-flow">
			{#each chatLog as chat}
				<div class="msg {chat.role}">
					<div class="bubble">{chat.text}</div>
				</div>
			{/each}

			{#if step === 2}
				<div class="input-row fade-in">
					<input type="text" bind:value={subTopic} placeholder="여기에 내용을 써주세요..." on:keypress={(e)=>e.key==='Enter' && handleTopicSubmit()}/>
					<button on:click={handleTopicSubmit}>전송</button>
				</div>
			{/if}

			{#if step === 3}
				<div class="final-form fade-in">
					<div class="field">
						<label>📸 현장 사진을 보여주시면 더 좋아요</label>
						<input type="file" bind:this={imageInput} accept="image/*" />
					</div>
					<div class="field">
						<textarea bind:value={userQuestion} placeholder={placeholderText}></textarea>
					</div>
					<div class="action-btns">
						<button class="btn-reset" on:click={()=>{step=1; subTopic=''; userQuestion=''; resultHtml='';}}>처음으로</button>
						<button class="btn-run" on:click={runAI} disabled={isLoading}>
							{isLoading ? '뽀득 전문가 분석 중...' : '전문 진단서 받기'}
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if resultHtml}
		<div class="result-viewer fade-in">{@html resultHtml}</div>
	{/if}
</div>

<style>
	:global(body) { background: #f4f6f9; font-family: 'Pretendard', sans-serif; padding: 20px; margin: 0; }
	.app { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 32px; padding: 30px; box-shadow: 0 10px 40px rgba(0,0,0,0.05); }
	.brand { color: #1a73e8; font-weight: 800; font-size: 11px; letter-spacing: 1px; text-align: center; margin-bottom: 5px; }
	h1 { font-size: 20px; text-align: center; margin: 0 0 30px 0; color: #222; }

	.main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
	.menu-card { background: #fff; border: 1.5px solid #eee; border-radius: 20px; padding: 25px 10px; cursor: pointer; transition: 0.2s; border-bottom: 4px solid #eee; }
	.menu-card:hover { border-color: #1a73e8; background: #f8fbff; transform: translateY(-3px); border-bottom-color: #1a73e8; }
	.icon { font-size: 26px; display: block; margin-bottom: 12px; }
	.menu-card strong { display: block; font-size: 14px; color: #333; margin-bottom: 6px; }
	.menu-card p { font-size: 11px; color: #999; margin: 0; line-height: 1.4; }

	.chat-flow { display: flex; flex-direction: column; gap: 16px; }
	.msg { display: flex; flex-direction: column; }
	.msg.ai { align-items: flex-start; }
	.msg.user { align-items: flex-end; }
	.bubble { max-width: 85%; padding: 14px 18px; border-radius: 20px; font-size: 14px; line-height: 1.6; }
	.msg.ai .bubble { background: #f1f3f4; color: #333; border-top-left-radius: 4px; }
	.msg.user .bubble { background: #1a73e8; color: #fff; border-top-right-radius: 4px; }

	.input-row { display: flex; gap: 8px; }
	.input-row input { flex: 1; padding: 14px; border: 1.5px solid #ddd; border-radius: 16px; outline: none; }
	.input-row button { background: #1a73e8; color: white; border: none; padding: 0 20px; border-radius: 16px; font-weight: bold; cursor: pointer; }

	.final-form { background: #f8f9fa; padding: 20px; border-radius: 24px; margin-top: 10px; }
	.field { margin-bottom: 15px; }
	.field label { font-size: 12px; font-weight: bold; color: #666; display: block; margin-bottom: 10px; }
	textarea { width: 100%; height: 130px; border: 1.5px solid #ddd; border-radius: 16px; padding: 15px; box-sizing: border-box; resize: none; font-size: 14px; outline: none; background: #fff; }
	
	.action-btns { display: flex; gap: 10px; margin-top: 15px; }
	.btn-run { flex: 3; background: #1a73e8; color: #fff; border: none; padding: 16px; border-radius: 16px; font-weight: bold; cursor: pointer; }
	.btn-reset { flex: 1; background: #fff; border: 1px solid #ddd; border-radius: 16px; cursor: pointer; font-size: 12px; }

	.result-viewer { margin-top: 30px; background: #fff; border: 2px solid #eef2f6; border-radius: 24px; padding: 25px; font-size: 14px; line-height: 1.8; color: #333; }
	.fade-in { animation: fadeIn 0.4s ease-out; }
	@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>