<template>
  <v-navigation-drawer
    v-model="model"
    location="right"
    temporary
    width="480"
  >
    <template v-if="current">
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
          <StatusChip :status="current.statut"/>
          <span class="text-caption text-medium-emphasis">{{ current.id }}</span>
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

        <!-- Historique des traitements -->
        <div class="d-flex align-center mb-2 ga-2">
          <span class="text-subtitle-2 font-weight-medium">Historique des traitements</span>
          <v-chip v-if="detail?.traitements?.length" size="x-small" label>{{ detail.traitements.length }}</v-chip>
        </div>

        <div v-if="loadingDetail" class="d-flex justify-center pa-4">
          <v-progress-circular indeterminate size="24"/>
        </div>

        <v-alert
          v-else-if="detailError"
          type="error" variant="tonal" density="compact"
          class="mb-4" icon="mdi-cloud-off-outline"
        >
          <div class="text-body-2 mb-2">{{ detailError }}</div>
          <v-btn size="x-small" variant="tonal" color="error" @click="loadDetail">Réessayer</v-btn>
        </v-alert>

        <div
          v-else-if="!detail?.traitements?.length"
          class="text-body-2 text-medium-emphasis text-center pa-4 rounded border"
        >
          Aucune tentative de traitement enregistrée pour ce message.
        </div>

        <v-timeline v-else density="compact" side="end" truncate-line="both" class="mb-4">
          <v-timeline-item
            v-for="tr in detail.traitements"
            :key="tr.traitementId ?? tr.numeroTentative"
            :dot-color="tr.statut === 'SUCCES' ? 'success' : 'error'"
            :icon="tr.statut === 'SUCCES' ? 'mdi-check' : 'mdi-close'"
            size="small"
            fill-dot
          >
            <div class="d-flex align-center ga-2 mb-1 flex-wrap">
              <span class="text-body-2 font-weight-medium">Tentative n°{{ tr.numeroTentative }}</span>
              <v-chip size="x-small" :color="tr.statut === 'SUCCES' ? 'success' : 'error'" label>
                {{ tr.statut === 'SUCCES' ? 'Succès' : 'Échec' }}
              </v-chip>
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ formatDate(tr.dateDebut ?? tr.dateCreation) }}
              <template v-if="tr.dateFin"> → {{ formatDate(tr.dateFin) }}</template>
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ tr.workerHostname ?? '—' }}<template v-if="tr.workerIp"> ({{ tr.workerIp }})</template>
            </div>
            <div v-if="tr.correlationId" class="text-caption text-medium-emphasis font-mono">
              {{ tr.correlationId }}
            </div>
            <v-alert
              v-if="tr.statut === 'ERREUR'"
              type="error" variant="tonal" density="compact"
              class="mt-2" icon="mdi-alert-circle-outline"
            >
              <div class="text-caption font-weight-bold">{{ ERREUR_CATEGORIE_LABELS[tr.erreurCategorie] ?? tr.erreurCategorie }}</div>
              <div class="text-caption">{{ tr.erreurMessage ?? 'Cause inconnue' }}</div>
            </v-alert>
          </v-timeline-item>
        </v-timeline>

        <!-- Action replay -->
        <v-btn
          v-if="current.statut === 'EN_ERREUR'"
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
        Êtes-vous sûr de vouloir rejouer le message <strong>{{ current?.id }}</strong> ?
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
import { computed, ref, watch } from 'vue'
import { fetchMessage, replaySingle } from '../services/api.js'
import StatusChip from './StatusChip.vue'

const model = defineModel({ type: Boolean, default: false })

const props = defineProps({
  // Ligne de la liste (MessageSummary) : sert d'affichage optimiste pendant
  // que le détail (avec l'historique des traitements) se charge.
  message: { type: Object, default: null },
})

const emit = defineEmits(['replayed'])

const confirmDialog = ref(false)
const replaying     = ref(false)

const detail        = ref(null)
const loadingDetail  = ref(false)
const detailError    = ref(null)

// MessageDetail une fois chargé, sinon retombe sur la ligne de liste (résumé).
const current = computed(() => detail.value ?? props.message)

const ERREUR_CATEGORIE_LABELS = {
  METIER:     'Erreur métier',
  TECHNIQUE:  'Erreur technique',
  INATTENDUE: 'Erreur inattendue',
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('fr-CH', { timeZone: 'Europe/Zurich' })
}

const metaRows = computed(() => {
  if (!current.value) return []
  const m = current.value
  return [
    { label: 'Direction',   value: m.direction },
    { label: 'Type',        value: m.type },
    { label: 'Utilisateur', value: m.utilisateur },
    { label: 'Horodatage',  value: formatDate(m.timestamp) },
  ]
})

async function loadDetail() {
  if (!props.message) return
  loadingDetail.value = true
  detailError.value   = null
  detail.value         = null
  try {
    detail.value = await fetchMessage(props.message.id)
  } catch (e) {
    detailError.value = e.status === 503
      ? 'Le service est momentanément indisponible.'
      : (e.message || 'Impossible de charger le détail du message.')
  } finally {
    loadingDetail.value = false
  }
}

// Recharge le détail (et son historique de traitements) à chaque ouverture.
watch([model, () => props.message?.id], ([open]) => {
  if (open && props.message) loadDetail()
})

async function doReplay() {
  if (!current.value) return
  replaying.value = true
  try {
    const updated = await replaySingle(current.value.id)
    detail.value = updated
    emit('replayed', updated)
    confirmDialog.value = false
    model.value = false
  } finally {
    replaying.value = false
  }
}
</script>
