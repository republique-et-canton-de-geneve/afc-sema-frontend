<template>
  <div class="d-flex align-center ga-2">
    <v-btn
      icon="mdi-refresh"
      size="small"
      variant="text"
      title="Rafraîchir"
      @click="emit('refresh')"
    />
    <v-chip
      :color="paused ? 'grey' : 'success'"
      variant="tonal"
      size="small"
      class="cursor-pointer"
      @click="toggle"
    >
      <v-icon start :icon="paused ? 'mdi-pause-circle' : 'mdi-sync'"/>
      {{ paused ? 'Auto-refresh pausé' : `Auto-refresh ${intervalSec}s` }}
    </v-chip>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  intervalSec: { type: Number, default: 10 },
})

const emit = defineEmits(['refresh'])

const paused = ref(true)
let timer = null

function startTimer() {
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    if (!paused.value) emit('refresh')
  }, props.intervalSec * 1000)
}

function toggle() {
  paused.value = !paused.value
}

onMounted(startTimer)
onUnmounted(() => clearInterval(timer))
watch(() => props.intervalSec, startTimer)
</script>
