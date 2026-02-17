<script>
	import './styles.css';

	export let data;    
	export let params;  

	let password = '';
	let isAuthenticated = false;

	// 비밀번호 확인 함수
	function checkPassword() {
		if (password === '1234') {
			isAuthenticated = true;
		} else {
			alert('비밀번호가 올바르지 않습니다.');
		}
	}

	// 상단 중앙에 표시될 문구 (원하는 대로 수정 가능합니다)
	const quote = '청소는 비움 너머 새로운 삶을 채우는 시작입니다.';
</script>

<div class="app">
	{#if !isAuthenticated}
		<div class="login-wrapper">
			<div class="login-box">
				<h1 class="logo-text">CleanHelp</h1>
				<p>권한이 있는 사용자만 접속 가능합니다.</p>
				<div class="input-group">
					<input
						type="password"
						bind:value={password}
						placeholder="비밀번호 입력"
						on:keydown={(e) => e.key === 'Enter' && checkPassword()}
					/>
					<button on:click={checkPassword}>확인</button>
				</div>
			</div>
		</div>
	{:else}
		<header>
			<div class="header-content">
				<div class="logo">
					<a href="/">CleanHelp</a>
				</div>

				<div class="mind-quote">
					"{quote}"
				</div>

				<div class="header-right"></div>
			</div>
		</header>

		<main>
			<slot />
		</main>

		<footer>
			<p>© 2026 CleanHelp. All rights reserved.</p>
		</footer>
	{/if}
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	/* 비밀번호 입력 화면 스타일 */
	.login-wrapper {
		flex: 1;
		display: flex;
		justify-content: center;
		align-items: center;
		background-color: #f8f9fa;
	}
	.login-box {
		background: white;
		padding: 40px;
		border-radius: 15px;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
		text-align: center;
	}
	.logo-text {
		color: #2ecc71;
		font-size: 2.5rem;
		margin-bottom: 10px;
		font-weight: 900;
	}
	.input-group {
		margin-top: 20px;
		display: flex;
		gap: 10px;
		justify-content: center;
	}
	input {
		padding: 12px;
		border: 1px solid #ddd;
		border-radius: 8px;
		width: 200px;
	}
	button {
		padding: 12px 24px;
		background: #2ecc71;
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-weight: bold;
	}

	/* 헤더 스타일 */
	header {
		background: white;
		border-bottom: 1px solid #eee;
		padding: 0 2rem;
	}
	.header-content {
		max-width: 80rem; /* 문구가 길 수 있으므로 폭을 조금 넓혔습니다 */
		margin: 0 auto;
		height: 70px;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.logo a {
		color: #2ecc71;
		font-weight: 900;
		font-size: 1.5rem;
		text-decoration: none;
	}

	/* 중앙 문구 스타일 */
	.mind-quote {
		flex: 1;
		text-align: center;
		color: #555;
		font-style: italic;
		font-size: 0.95rem;
		font-weight: 500;
		padding: 0 20px;
		word-break: keep-all; /* 문구가 자연스럽게 줄바꿈되도록 설정 */
	}

	.header-right {
		width: 120px; /* 로고 너비와 비슷하게 맞춰서 중앙 정렬 유지 */
	}

	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 1rem;
		width: 100%;
		max-width: 64rem;
		margin: 0 auto;
		box-sizing: border-box;
	}

	footer {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		padding: 24px;
		border-top: 1px solid #eee;
		color: #888;
		font-size: 0.85rem;
	}

	/* 모바일 대응: 화면이 좁아지면 문구 숨기기 혹은 조정 */
	@media (max-width: 768px) {
		.mind-quote {
			font-size: 0.8rem;
		}
		.header-right {
			width: 0;
		}
	}
</style>
