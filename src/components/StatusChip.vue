<template>
  <v-chip
    :color="color"
    size="small"
    label
    variant="flat"
    class="font-weight-medium"
  >
    {{ label }}
  </v-chip>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, required: true },
})

const MAP = {
  EN_ERREUR:     { color: 'error',   label: 'En erreur' },
  EN_TRAITEMENT: { color: 'warning', label: 'En traitement' },
  A_TRAITER:     { color: 'info',    label: 'À traiter' },
  TRAITE:        { color: 'success', label: 'Traité' },
}

const color = computed(() => MAP[props.status]?.color ?? 'grey')
const label = computed(() => MAP[props.status]?.label ?? props.status)
</script>
