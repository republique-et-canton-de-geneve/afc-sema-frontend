<template>
  <v-navigation-drawer
    v-model="model"
    location="right"
    temporary
    width="480"
  >
    <template v-if="message">
      <!-- Header -->
      <v-toolbar color="surface" border="b">
        <v-toolbar-title class="text-body-1 font-weight-bold">
          Détail message
        </v-toolbar-title>
        <template #append>
          <v-btn icon="mdi-close" variant="text" @click="model = false"/>
        </template>
      </v-toolbar>

      <v-container class="pa-4">
        <!-- Statut -->
        <div class="d-flex align-center mb-4 ga-2">
          <StatusChip :status="message.statut"/>
          <span class="text-caption text-medium-emphasis">{{ message.id }}</span>
        </div>

        <!-- Métadonnées principales -->
        <v-table density="compact" class="mb-4 rounded border">
          <tbody>
            <tr v-for="row in metaRows" :key="row.label">
              <td class="text-medium-emphasis text-body-2 py-2" style="width:40%">{{ row.label }}</td>
              <td class="text-body-2 py-2 font-weight-medium">{{ row.value ?? '—' }}</td>
            </tr>
          </tbody>
        </v-table>

        <!-- Note V1 -->
        <v-alert type="info" variant="tonal" density="compact" class="mb-4" icon="mdi-information">
          <span class="text-caption">Message d'erreur brut : non disponible en V1</span>
        </v-alert>

        <!-- Action replay -->
        <v-btn
          v-if="message.statut === 'EN_ERREUR'"
          color="warning"
          variant="flat"
          block
          prepend-icon="mdi-replay"
          :loading="replaying"
          @click="confirmDialog = true"
        >
          Rejouer ce message
        </v-btn>
      </v-container>
    </template>

    <template v-else>
      <v-container class="d-flex align-center justify-center fill-height">
        <v-progress-circular indeterminate/>
      </v-container>
    </template>
  </v-navigation-drawer>

  <!-- Confirmation dialog -->
  <v-dialog v-model="confirmDialog" max-width="400">
    <v-card>
      <v-card-title class="text-h6">Confirmer le rejeu</v-card-title>
      <v-card-text>
        Êtes-vous sûr de vouloir rejouer le message <strong>{{ message?.id }}</strong> ?
        Son statut passera à <strong>A_TRAITER</strong>.
      </v-card-text>
      <v-card-actions>
        <v-spacer/>
        <v-btn variant="text" @click="confirmDialog = false">Annuler</v-btn>
        <v-btn color="warning" variant="flat" :loading="replaying" @click="doReplay">
          Confirmer
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { replaySingle } from '../services/api.js'
import StatusChip from './StatusChip.vue'

const model = defineModel({ type: Boolean, default: false })

const props = defineProps({
  message: { type: Object, default: null },
})

const emit = defineEmits(['replayed'])

const confirmDialog = ref(false)
const replaying     = ref(false)

const metaRows = computed(() => {
  if (!props.message) return []
  const m = props.message
  return [
    { label: 'Direction',   value: m.direction },
    { label: 'Type',        value: m.type },
    { label: 'Utilisateur', value: m.utilisateur },
    { label: 'Horodatage',  value: new Date(m.timestamp).toLocaleString('fr-FR') },
    { label: 'Nb rejeux',   value: m.nbRejeux },
    ...(m.nbTentativesEnvoi != null ? [{ label: 'Tentatives envoi', value: m.nbTentativesEnvoi }] : []),
    ...(m.datePublication   ? [{ label: 'Date publication',  value: new Date(m.datePublication).toLocaleString('fr-FR') }] : []),
  ]
})

async function doReplay() {
  if (!props.message) return
  replaying.value = true
  try {
    const updated = await replaySingle(props.message.id)
    emit('replayed', updated)
    confirmDialog.value = false
    model.value = false
  } finally {
    replaying.value = false
  }
}
</script>
