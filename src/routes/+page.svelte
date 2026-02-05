<script>
	import { onMount } from 'svelte';

	let GoogleGenerativeAI;
	let genAI;

	// [상태 관리] 단계별 질문 흐름 제어
	let step = 1;
	let chatLog = [
		{
			role: 'ai',
			text: '안녕하세요, 뽀득 전문 진단 시스템입니다. 원활한 상담을 위해 먼저 원하시는 상담 분야를 선택해 주세요.'
		},
		{
			role: 'ai',
			text: '1. 🧹 입주/거주 환경 진단\n2. 📍 구역별 오염 집중 처방\n3. ♻️ 분리수거 및 배출 가이드\n4. ❓ 기타 일반 문의'
		}
	];

	let userPath = { main: '', sub: '' };
	let userQuestion = '';
	let resultHtml = '';
	let isLoading = false;
	let imageInput;
	let currentReportId = '';

	// [내부 로직: 질문 속에 옵션을 숨김]
	const scriptData = {
		1: {
			label: '입주/거주 진단',
			question:
				'구체적인 상황을 알려주세요.\n1) 이사 전 빈집(입주 청소)\n2) 현재 짐이 있는 상태(거주 청소)'
		},
		2: {
			label: '구역별 집중 전략',
			question:
				'어느 구역의 케어가 가장 시급하신가요?\n1) 주방 기름때 및 후드\n2) 욕실 물때 및 곰팡이\n3) 창틀 및 베란다 외부'
		},
		3: {
			label: '분리수거 가이드',
			question:
				'진단이 필요한 품목을 골라주세요.\n1) 대형 폐기물/가전 배출\n2) 헷갈리는 재활용 분리수거\n3) 사진 찍어 직접 물어보기'
		}
	};

	onMount(async () => {
		try {
			const module = await import('https://esm.run/@google/generative-ai');
			GoogleGenerativeAI = module.GoogleGenerativeAI;
			const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
			if (API_KEY) genAI = new GoogleGenerativeAI(API_KEY);
		} catch (e) {
			console.error('초기화 실패', e);
		}
	});

	// [번호 선택 처리 함수]
	function selectOption(num) {
		if (step === 1) {
			const selected = scriptData[num] || {
				label: '기타 문의',
				question: '무엇이든 물어보세요. 뽀득의 기준으로 답변해 드립니다.'
			};
			userPath.main = selected.label;
			chatLog = [
				...chatLog,
				{ role: 'user', text: `${num}번 선택` },
				{ role: 'ai', text: selected.question }
			];
			step = 2;
		} else if (step === 2) {
			userPath.sub = `${num}번 항목 관련`;
			chatLog = [
				...chatLog,
				{ role: 'user', text: `${num}번 선택` },
				{
					role: 'ai',
					text: "확인되었습니다. 현장 사진을 첨부하시거나 구체적인 오염 상태를 아래에 적어주시면 '뽀득 진단 리포트'를 생성합니다."
				}
			];
			step = 3;
		}
	}

	async function runAI() {
		if (!genAI) return;
		isLoading = true;
		currentReportId = `BD-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

		try {
			const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
			const stylePrompt = `[Role] 뽀득 수석 컨설턴트. [Context] ${userPath.main} 상담. [Goal] 전문가적 통찰을 담은 결함 체크리스트 포함 답변.`;

			let parts = [`${stylePrompt}\n상담 내용: ${userQuestion}`];
			if (imageInput?.files[0]) {
				const base64 = await new Promise((r) => {
					const reader = new FileReader();
					reader.onloadend = () => r(reader.result.split(',')[1]);
					reader.readAsDataURL(imageInput.files[0]);
				});
				parts.push({ inlineData: { data: base64, mimeType: imageInput.files[0].type } });
			}

			const result = await model.generateContent(parts);
			resultHtml = `<div class="report-box"><strong>[뽀득 진단 리포트 ${currentReportId}]</strong><br>${result.response.text()}</div>`;
		} catch (e) {
			resultHtml = '에러: ' + e.message;
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="app">
	<div class="chat-window">
		{#each chatLog as chat}
			<div class="msg {chat.role}">
				<div class="bubble">{chat.text}</div>
			</div>
		{/each}

		{#if step < 3}
			<div class="num-pad">
				{#each [1, 2, 3, 4] as n}
					<button on:click={() => selectOption(n)}>{n}번 선택</button>
				{/each}
			</div>
		{/if}

		{#if step === 3}
			<div class="final-input">
				<input type="file" bind:this={imageInput} accept="image/*" />
				<textarea bind:value={userQuestion} placeholder="오염 상태나 궁금한 점을 적어주세요."
				></textarea>
				<button class="main-btn" on:click={runAI} disabled={isLoading}>
					{isLoading ? '분석 중...' : '진단 결과 보기'}
				</button>
			</div>
		{/if}

		{#if resultHtml}
			<div class="final-result">{@html resultHtml}</div>
		{/if}
	</div>
</div>

<style>
	:global(body) {
		background: #f5f7f9;
		margin: 0;
		padding: 10px;
		font-family: 'Pretendard', sans-serif;
	}
	.app {
		max-width: 500px;
		margin: 0 auto;
		background: #fff;
		border-radius: 20px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
		height: 90vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.chat-window {
		flex: 1;
		overflow-y: auto;
		padding: 20px;
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
		max-width: 80%;
		padding: 12px 16px;
		border-radius: 15px;
		font-size: 14px;
		line-height: 1.6;
		white-space: pre-wrap;
	}
	.msg.ai .bubble {
		background: #f0f2f5;
		color: #333;
		border-top-left-radius: 2px;
	}
	.msg.user .bubble {
		background: #1a73e8;
		color: #fff;
		border-top-right-radius: 2px;
	}

	.num-pad {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin-top: 10px;
	}
	.num-pad button {
		padding: 12px;
		background: #fff;
		border: 1.5px solid #1a73e8;
		color: #1a73e8;
		border-radius: 10px;
		cursor: pointer;
		font-weight: bold;
	}
	.num-pad button:hover {
		background: #1a73e8;
		color: #fff;
	}

	.final-input {
		background: #f8f9fa;
		padding: 15px;
		border-radius: 15px;
		margin-top: 10px;
	}
	textarea {
		width: 100%;
		height: 80px;
		margin: 10px 0;
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 10px;
		resize: none;
		box-sizing: border-box;
	}
	.main-btn {
		width: 100%;
		padding: 15px;
		background: #1a73e8;
		color: #fff;
		border: none;
		border-radius: 10px;
		font-weight: bold;
		cursor: pointer;
	}
	.final-result {
		margin-top: 20px;
		padding: 15px;
		background: #e8f0fe;
		border-radius: 10px;
		font-size: 14px;
		line-height: 1.7;
	}
</style>
