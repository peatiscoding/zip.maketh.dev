<script lang="ts">
  import '../app.css'
  import favicon from '$lib/assets/favicon.svg'
  import Footer from '$lib/components/footer.svelte'
  import NavBar from '$lib/components/nav-bar.svelte'

  let { children } = $props()
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<NavBar />
<div class="min-h-screen pt-[60px]">
  {@render children?.()}
  <Footer />
</div>
