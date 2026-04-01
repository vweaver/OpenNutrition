<script lang="ts">
	let {
		oncapture,
		onclose
	}: {
		oncapture: (base64: string) => void;
		onclose: () => void;
	} = $props();

	let videoEl = $state<HTMLVideoElement | null>(null);
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let stream = $state<MediaStream | null>(null);
	let cameraFailed = $state(false);
	let cameraReady = $state(false);

	$effect(() => {
		startCamera();
		return () => stopCamera();
	});

	async function startCamera() {
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'environment' }
			});
			if (videoEl) {
				videoEl.srcObject = stream;
				await videoEl.play();
				cameraReady = true;
			}
		} catch {
			cameraFailed = true;
		}
	}

	function stopCamera() {
		if (stream) {
			stream.getTracks().forEach((t) => t.stop());
			stream = null;
		}
		cameraReady = false;
	}

	function capture() {
		if (!videoEl || !canvasEl) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		canvasEl.width = videoEl.videoWidth;
		canvasEl.height = videoEl.videoHeight;
		ctx.drawImage(videoEl, 0, 0);

		const base64 = canvasEl.toDataURL('image/jpeg', 0.85);
		stopCamera();
		oncapture(base64);
	}

	function handleFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result as string;
			oncapture(result);
		};
		reader.readAsDataURL(file);
	}

	function handleClose() {
		stopCamera();
		onclose();
	}
</script>

<div class="relative rounded-xl bg-black overflow-hidden">
	{#if !cameraFailed}
		<!-- Live camera preview -->
		<video
			bind:this={videoEl}
			class="w-full aspect-[3/4] object-cover"
			playsinline
			muted
			autoplay
		></video>
		<canvas bind:this={canvasEl} class="hidden"></canvas>

		<!-- Camera controls overlay -->
		<div class="absolute bottom-0 inset-x-0 flex items-center justify-center gap-4 p-4 bg-gradient-to-t from-black/60 to-transparent">
			<button
				onclick={handleClose}
				class="rounded-full bg-gray-700/80 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600 transition-colors"
			>
				Close
			</button>
			<button
				onclick={capture}
				disabled={!cameraReady}
				class="rounded-full bg-white h-16 w-16 flex items-center justify-center shadow-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"
				aria-label="Capture photo"
			>
				<div class="h-12 w-12 rounded-full border-4 border-gray-800"></div>
			</button>
			<div class="w-[72px]"></div>
		</div>
	{:else}
		<!-- Fallback: file picker -->
		<div class="flex flex-col items-center justify-center gap-4 p-8 bg-gray-100 dark:bg-gray-800 rounded-xl">
			<svg class="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
				<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
			</svg>
			<p class="text-sm text-gray-600 dark:text-gray-300">Camera not available. Select an image instead.</p>
			<label class="cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors">
				Choose Photo
				<input
					type="file"
					accept="image/*"
					capture="environment"
					onchange={handleFileInput}
					class="hidden"
				/>
			</label>
			<button
				onclick={handleClose}
				class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
			>
				Cancel
			</button>
		</div>
	{/if}
</div>
