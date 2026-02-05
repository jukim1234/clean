<script>
	import { onMount } from 'svelte';

	let GoogleGenerativeAI;
	let genAI;

	// 단계 관리: 1(대분류 선택), 2(중분류 번호입력), 3(상세내용 및 사진)
	let step = 1;
	let mainSelection = '';
	let subSelectionLabel = '';
	let placeholderText = '';
	let chatLog = [];

	let userNumberInput = ''; // 번호 입력값
	let userQuestion = ''; // 상세 문의 내용
	let resultHtml = '';
	let isLoading = false;
	let imageInput;

	// [대분류] - 화면 노출
	const mainOptions = [
		{ id: 'space', label: '🏠 청소 공간 유형', desc: '이사/거주/부분 선택' },
		{ id: 'stain', label: '📍 세부 오염 처리', desc: '창틀, 주방, 욕실 등' },
		{ id: 'recycle', label: '♻️ 분리수거/배출', desc: '배출 원칙, 상세 방법' },
		{ id: 'mind', label: '🧹 청소 시작 마인드셋', desc: '시작 요령, 마인드' }
	];

	// [중분류 로직 데이터] - 사용자는 질문을 읽고 번호를 입력해야 함
	const subLogic = {
		space: {
			question:
				'청소 공간 유형을 선택해주세요.\n1. 이사/입주 청소 (빈 집 상태)\n2. 거주/부분 청소 (살림 짐 있는 상태)',
			options: {
				'1': {
					label: '이사/입주',
					guide: '예: 24평형 구축 아파트입니다. 창틀 오염과 니코틴 제거가 시급합니다.'
				},
				'2': {
					label: '거주/부분',
					guide: '예: 현재 거주 중인 30평형입니다. 주방과 거실 바닥 위주로 진행하고 싶습니다.'
				}
			}
		},
		stain: {
			question:
				'집중 진단이 필요한 오염 구역을 선택해주세요.\n1. 창틀 및 베란다\n2. 주방 및 욕실\n3. 바닥 오염 및 기타',
			options: {
				'1': {
					label: '창틀/베란다',
					guide: '예: 창틀 하단 곰팡이가 심합니다. 외창 청소 포함 여부도 알려주세요.'
				},
				'2': {
					label: '주방/욕실',
					guide: '예: 욕실 실리콘 곰팡이와 주방 후드 기름때가 고민입니다.'
				},
				'3': {
					label: '바닥/기타',
					guide: '예: 반려동물 얼룩이 바닥에 배어있습니다. 특수 세척이 필요할까요?'
				}
			}
		},
		recycle: {
			question:
				'분리수거 및 배출 가이드를 선택해주세요.\n1. 일반/재활용 분리수거 원칙\n2. 대형 폐기물/가전 배출법\n3. 사진으로 직접 문의하기',
			options: {
				'1': {
					label: '분리수거 원칙',
					guide: '예: 음식물 묻은 플라스틱 용기도 재활용이 가능한지 궁금합니다.'
				},
				'2': {
					label: '폐기물 배출',
					guide: '예: 안 쓰는 낡은 소파와 고장 난 소형 가전 배출 방법을 알려주세요.'
				},
				'3': {
					label: '사진 진단',
					guide: '예: 첨부한 사진 속 물건을 어떤 봉투에 담아 버려야 하나요?'
				}
			}
		},
		mind: {
			question:
				'청소 시작이 막막하신가요? 질문을 골라주세요.\n1. 청소 마인드셋 (동기부여)\n2. 실천 요령 (오늘의 루틴)',
			options: {
				'1': {
					label: '마인드셋',
					guide: '예: 집 전체가 쓰레기장 같습니다. 포기하고 싶은데 조언 부탁드려요.'
				},
				'2': {
					label: '실천 요령',
					guide: '예: 퇴근 후 10분만 투자해서 거실을 유지하는 방법을 알려주세요.'
				}
			}
		}
	};

	onMount(async () => {
		try {
			const module = await import('https://esm.run/@google/generative-ai');
			GoogleGenerativeAI = module.GoogleGenerativeAI;
			const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
			if (API_KEY) genAI = new GoogleGenerativeAI(API_KEY);
		} catch (e) {
			console.error('API 초기화 실패', e);
		}
	});

	// 대분류 선택 시
	function handleMainSelect(id) {
		mainSelection = id;
		chatLog = [{ role: 'ai', text: subLogic[id].question }];
		step = 2;
	}

	// 번호 입력 제출 시
	function handleNumberSubmit() {
		const choice = subLogic[mainSelection].options[userNumberInput.trim()];
		if (choice) {
			subSelectionLabel = choice.label;
			placeholderText = choice.guide;
			chatLog = [
				...chatLog,
				{ role: 'user', text: `${userNumberInput}번 선택: ${choice.label}` },
				{
					role: 'ai',
					text: '좋습니다. 상담에 필요한 정보를 아래에 입력해주세요. 사진을 함께 주시면 뽀득 전문가가 더 정밀하게 진단합니다.'
				}
			];
			step = 3;
		} else {
			alert('번호를 다시 확인해주세요. (질문에 적힌 번호만 입력 가능합니다)');
		}
	}

	async function runAI() {
		if (!genAI) return;
		isLoading = true;
		resultHtml = '뽀득 AI가 상담 리포트를 작성 중입니다...';

		try {
			const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
			const prompt = `[뽀득 전문가 모드]\n분류: ${userPathInfo()}\n내용: ${userQuestion}\n[미션] 15년 경력 노하우를 담아 결함 체크리스트와 처방전을 작성해줘.`;

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
			resultHtml = `<strong>[뽀득 AI 진단서]</strong><br><br>${result.response.text().replace(/\n/g, '<br>')}`;
		} catch (e) {
			resultHtml = '상담 중 오류: ' + e.message;
		} finally {
			isLoading = false;
		}
	}

	function userPathInfo() {
		const mainName = mainOptions.find((o) => o.id === mainSelection)?.label;
		return `${mainName} > ${subSelectionLabel}`;
	}

	function reset() {
		step = 1;
		mainSelection = '';
		userNumberInput = '';
		userQuestion = '';
		resultHtml = '';
		chatLog = [];
	}
</script>

<div class="app-container">
	<header>
		<div class="top-label">Expert Consultation</div>
		<h1>뽀득 전문 진단 v2.3</h1>
	</header>

	{#if step === 1}
		<div class="main-grid">
			{#each mainOptions as opt}
				<button class="main-card" on:click={() => handleMainSelect(opt.id)}>
					<span class="icon">{opt.label.split(' ')[0]}</span>
					<div class="txt">
						<strong>{opt.label.split(' ')[1]}</strong>
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
				<div class="input-area fade-in">
					<input
						type="text"
						bind:value={userNumberInput}
						placeholder="번호만 입력 (예: 1)"
						on:keypress={(e) => e.key === 'Enter' && handleNumberSubmit()}
					/>
					<button on:click={handleNumberSubmit}>번호 입력</button>
				</div>
			{/if}

			{#if step === 3}
				<div class="final-form fade-in">
					<div class="info-tag">{userPathInfo()}</div>
					<div class="file-box">
						<label for="img">📸 현장 사진 첨부 (선택)</label>
						<input type="file" id="img" bind:this={imageInput} accept="image/*" />
					</div>
					<textarea bind:value={userQuestion} placeholder={placeholderText}></textarea>
					<div class="btns">
						<button class="btn-reset" on:click={reset}>처음부터</button>
						<button class="btn-run" on:click={runAI} disabled={isLoading}>
							{isLoading ? '뽀득 전문가 분석 중...' : '전문 진단 요청'}
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if resultHtml}
		<div class="result-box">
			<div class="res-body">{@html resultHtml}</div>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		background: #f0f4f8;
		font-family: 'Pretendard', sans-serif;
		padding: 15px;
		margin: 0;
	}
	.app-container {
		max-width: 480px;
		margin: 0 auto;
		background: #fff;
		border-radius: 28px;
		padding: 30px;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
		min-height: 80vh;
	}
	.top-label {
		color: #1a73e8;
		font-weight: 800;
		font-size: 11px;
		text-transform: uppercase;
		text-align: center;
	}
	h1 {
		font-size: 22px;
		text-align: center;
		margin-top: 5px;
		margin-bottom: 25px;
		color: #222;
	}

	/* 대분류 그리드 */
	.main-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 12px;
	}
	.main-card {
		display: flex;
		align-items: center;
		gap: 15px;
		background: #fff;
		border: 1.5px solid #eee;
		padding: 18px;
		border-radius: 20px;
		cursor: pointer;
		text-align: left;
		transition: 0.2s;
	}
	.main-card:hover {
		border-color: #1a73e8;
		background: #f8fbff;
	}
	.main-card .icon {
		font-size: 24px;
	}
	.main-card strong {
		display: block;
		font-size: 16px;
		color: #333;
	}
	.main-card p {
		font-size: 12px;
		color: #888;
		margin: 4px 0 0;
	}

	/* 채팅 영역 */
	.chat-container {
		display: flex;
		flex-direction: column;
		gap: 15px;
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
		padding: 14px 18px;
		border-radius: 20px;
		font-size: 14px;
		line-height: 1.6;
		white-space: pre-wrap;
	}
	.msg.ai .bubble {
		background: #f1f3f4;
		color: #333;
		border-top-left-radius: 2px;
	}
	.msg.user .bubble {
		background: #1a73e8;
		color: #fff;
		border-top-right-radius: 2px;
	}

	/* 입력 영역 */
	.input-area {
		display: flex;
		gap: 10px;
		margin-left: 10px;
	}
	.input-area input {
		flex: 1;
		padding: 12px;
		border: 1.5px solid #ddd;
		border-radius: 12px;
		outline: none;
	}
	.input-area button {
		background: #1a73e8;
		color: #fff;
		border: none;
		padding: 0 20px;
		border-radius: 12px;
		font-weight: bold;
		cursor: pointer;
	}

	.final-form {
		background: #f8f9fa;
		padding: 20px;
		border-radius: 20px;
	}
	.info-tag {
		font-size: 12px;
		color: #1a73e8;
		font-weight: bold;
		margin-bottom: 15px;
	}
	.file-box {
		margin-bottom: 15px;
	}
	.file-box label {
		display: block;
		font-size: 13px;
		font-weight: bold;
		margin-bottom: 8px;
		color: #555;
	}
	textarea {
		width: 100%;
		height: 110px;
		border: 1.5px solid #ddd;
		border-radius: 12px;
		padding: 12px;
		box-sizing: border-box;
		resize: none;
		font-size: 14px;
		outline: none;
	}
	.btns {
		display: flex;
		gap: 10px;
		margin-top: 15px;
	}
	.btn-run {
		flex: 3;
		background: #1a73e8;
		color: #fff;
		border: none;
		padding: 15px;
		border-radius: 12px;
		font-weight: bold;
		cursor: pointer;
	}
	.btn-reset {
		flex: 1;
		background: #fff;
		border: 1px solid #ddd;
		border-radius: 12px;
		cursor: pointer;
		font-size: 13px;
	}

	.result-box {
		margin-top: 30px;
		background: #fff;
		border: 1px solid #eef2f6;
		border-radius: 20px;
		padding: 25px;
		font-size: 14px;
		line-height: 1.8;
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
