<template>
  <div class="d-flex align-start" style="min-height: calc(100vh - 64px)">

    <!-- ═══ Sidebar filtres ════════════════════════════════════════════════════ -->
    <aside
      class="bg-surface"
      style="
        width: 260px;
        min-width: 260px;
        position: sticky;
        top: 64px;
        height: calc(100vh - 64px);
        overflow-y: auto;
        border-right: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
      "
    >
      <div class="pa-5">

        <div class="text-overline font-weight-bold mb-4 text-medium-emphasis">Filtres</div>

        <!-- Direction -->
        <template v-if="showDirFilter">
          <div class="text-caption font-weight-medium text-medium-emphasis mb-2">Direction</div>
          <v-btn-toggle
            :model-value="selectedDirection ?? ''"
            color="primary"
            density="comfortable"
            divided
            class="mb-5 w-100"
            @update:model-value="v => setDirection(v === '' ? null : v)"
          >
            <v-btn value="" size="small" class="flex-1-1">Tous</v-btn>
            <v-btn value="INBOX" size="small" class="flex-1-1">
              <v-icon size="small" start>mdi-inbox-arrow-down</v-icon>Inbox
            </v-btn>
            <v-btn value="OUTBOX" size="small" class="flex-1-1">
              <v-icon size="small" start>mdi-inbox-arrow-up</v-icon>Outbox
            </v-btn>
          </v-btn-toggle>
        </template>

        <!-- Statuts -->
        <div class="text-caption font-weight-medium text-medium-emphasis mb-2">Statut</div>
        <div class="d-flex flex-column ga-1 mb-5">
          <v-chip
            v-for="s in STATUS_OPTIONS"
            :key="s.value"
            :color="selectedStatuses.includes(s.value) ? s.color : undefined"
            :variant="selectedStatuses.includes(s.value) ? 'flat' : 'tonal'"
            size="small"
            label
            class="justify-start"
            style="cursor: pointer; width: 100%"
            @click="toggleStatus(s.value)"
          >
            <template v-if="selectedStatuses.includes(s.value)" #prepend>
              <v-icon size="x-small">mdi-check</v-icon>
            </template>
            {{ s.label }}
          </v-chip>
        </div>

        <!-- Type de message -->
        <div class="text-caption font-weight-medium text-medium-emphasis mb-2">Type de message</div>
        <v-select
          v-model="selectedTypes"
          :items="availableTypes"
          :placeholder="availableTypes.length === 0 ? 'Chargement…' : 'Tous'"
          multiple
          clearable
          density="compact"
          hide-details
          class="mb-5"
          @update:model-value="onTypesChange"
        >
          <template #selection="{ item, index }">
            <v-chip v-if="index < 2" size="x-small" label class="mr-1">{{ item.title }}</v-chip>
            <span v-if="index === 2" class="text-caption text-medium-emphasis">
              +{{ selectedTypes.length - 2 }}
            </span>
          </template>
        </v-select>

        <!-- Réinitialiser -->
        <v-btn
          v-if="hasActiveFilter"
          variant="tonal"
          size="small"
          prepend-icon="mdi-filter-remove-outline"
          color="error"
          block
          @click="resetFilters"
        >
          Réinitialiser
        </v-btn>

      </div>
    </aside>

    <!-- ═══ Contenu principal ══════════════════════════════════════════════════ -->
    <div class="flex-grow-1 pa-6">

      <!-- En-tête -->
      <div class="d-flex align-center mb-5">
        <div class="flex-grow-1">
          <div class="text-h5 font-weight-bold">Messages</div>
          <div class="text-caption text-medium-emphasis">Consultation et administration</div>
        </div>
        <AutoRefreshControl :interval-sec="10" @refresh="onAutoRefresh"/>
      </div>

      <!-- Résumé inbox / outbox -->
      <div class="d-flex ga-4 mb-5 flex-wrap">

        <template v-if="loadingSummary">
          <v-card border class="flex-1-1" style="min-width:280px">
            <v-card-text><v-skeleton-loader type="heading, list-item-two-line"/></v-card-text>
          </v-card>
          <v-card v-if="!selectedDirection" border class="flex-1-1" style="min-width:280px">
            <v-card-text><v-skeleton-loader type="heading, list-item-two-line"/></v-card-text>
          </v-card>
        </template>

        <template v-else-if="summary">

          <!-- INBOX -->
          <v-card
            v-if="summary.inbox && selectedDirection !== 'OUTBOX'"
            border class="flex-1-1" style="min-width:280px"
          >
            <v-card-title class="text-subtitle-2 text-medium-emphasis d-flex align-center ga-1 pb-1">
              <v-icon size="small">mdi-inbox-arrow-down</v-icon>
              INBOX
            </v-card-title>
            <v-card-text class="d-flex ga-2 flex-wrap pt-0">
              <div
                v-for="s in STATUS_OPTIONS" :key="s.value"
                class="d-flex flex-column align-center justify-center pa-3 rounded flex-1-1"
                style="min-width:80px; cursor:pointer"
                :title="`Filtrer : INBOX — ${s.label}`"
                @click="filterFromSummary('INBOX', s.value)"
              >
                <span class="text-h5 font-weight-bold" :class="`text-${s.color}`">
                  {{ summary.inbox[s.value] ?? 0 }}
                </span>
                <span class="text-caption text-medium-emphasis text-center mt-1">{{ s.label }}</span>
              </div>
            </v-card-text>
          </v-card>

          <!-- OUTBOX -->
          <v-card
            v-if="summary.outbox && selectedDirection !== 'INBOX'"
            border class="flex-1-1" style="min-width:280px"
          >
            <v-card-title class="text-subtitle-2 text-medium-emphasis d-flex align-center ga-1 pb-1">
              <v-icon size="small">mdi-inbox-arrow-up</v-icon>
              OUTBOX
            </v-card-title>
            <v-card-text class="d-flex ga-2 flex-wrap pt-0">
              <div
                v-for="s in STATUS_OPTIONS" :key="s.value"
                class="d-flex flex-column align-center justify-center pa-3 rounded flex-1-1"
                style="min-width:80px; cursor:pointer"
                :title="`Filtrer : OUTBOX — ${s.label}`"
                @click="filterFromSummary('OUTBOX', s.value)"
              >
                <span class="text-h5 font-weight-bold" :class="`text-${s.color}`">
                  {{ summary.outbox[s.value] ?? 0 }}
                </span>
                <span class="text-caption text-medium-emphasis text-center mt-1">{{ s.label }}</span>
              </div>
            </v-card-text>
          </v-card>

        </template>

      </div>

      <!-- Liste des messages (dépliable) -->
      <v-expansion-panels v-model="tableExpanded">
        <v-expansion-panel value="messages">

          <v-expansion-panel-title>
            <span class="text-subtitle-1 font-weight-medium">Liste des messages</span>
          </v-expansion-panel-title>

          <v-expansion-panel-text>

            <!-- Barre d'actions -->
            <div class="d-flex align-center mb-4 pt-2 ga-3 flex-wrap">
              <v-spacer/>

              <v-btn
                color="warning"
                variant="flat"
                prepend-icon="mdi-replay"
                :disabled="selected.length === 0"
                :loading="replayingBatch"
                @click="batchDialog = true"
              >
                Rejouer la sélection ({{ selected.length }})
              </v-btn>

              <v-btn
                v-if="hasActiveFilter && total > 0"
                color="error"
                variant="flat"
                prepend-icon="mdi-replay-all"
                :loading="replayingFilter"
                @click="filterDialog = true"
              >
                Rejouer tous les résultats ({{ total }})
              </v-btn>

              <!-- Sélecteur de colonnes -->
              <v-menu :close-on-content-click="false" location="bottom end">
                <template #activator="{ props: menuProps }">
                  <v-btn
                    v-bind="menuProps"
                    icon="mdi-table-column"
                    size="small"
                    variant="text"
                    title="Choisir les colonnes"
                  />
                </template>
                <v-list density="compact" min-width="200">
                  <v-list-subheader>Colonnes visibles</v-list-subheader>
                  <v-list-item v-for="col in ALL_COLUMNS" :key="col.key" :title="col.title">
                    <template #prepend>
                      <v-checkbox-btn
                        :model-value="visibleColumnKeys.includes(col.key)"
                        @update:model-value="toggleColumn(col.key)"
                      />
                    </template>
                  </v-list-item>
                </v-list>
              </v-menu>
            </div>

            <!-- Table -->
            <v-card border>
              <v-data-table
                v-model="selected"
                :headers="headers"
                :items="messages"
                :loading="loading"
                item-value="id"
                show-select
                density="comfortable"
                :items-per-page="pageSize"
                :items-length="total"
                @update:page="p => { page.value = p - 1; load() }"
                @click:row="(_, { item }) => openDrawer(item)"
              >
                <template #item.statut="{ item }">
                  <StatusChip :status="item.statut"/>
                </template>
                <template #item.timestamp="{ item }">
                  {{ new Date(item.timestamp).toLocaleString('fr-FR') }}
                </template>
                <template #item.nbRejeux="{ item }">
                  <v-chip size="x-small" :color="item.nbRejeux > 0 ? 'warning' : 'default'" label>
                    {{ item.nbRejeux }}
                  </v-chip>
                </template>
              </v-data-table>
            </v-card>

          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

    </div>

    <!-- Drawer détail (overlay, position dans le DOM sans importance) -->
    <MessageDetailDrawer
      v-model="drawerOpen"
      :message="selectedMessage"
      @replayed="onReplayed"
    />

    <!-- Dialog rejeu par filtre -->
    <v-dialog v-model="filterDialog" max-width="480">
      <v-card>
        <v-card-title class="text-h6">Rejouer tous les résultats filtrés</v-card-title>
        <v-card-text>
          <p class="mb-3">
            Vous allez rejouer <strong>{{ total }} message(s)</strong> correspondant aux filtres actifs :
          </p>
          <v-chip v-if="selectedDirection" size="small" label class="mr-2 mb-2" color="primary">
            {{ selectedDirection }}
          </v-chip>
          <v-chip
            v-for="s in selectedStatuses" :key="s"
            size="small" label class="mr-2 mb-2"
            :color="STATUS_OPTIONS.find(o => o.value === s)?.color"
          >{{ STATUS_OPTIONS.find(o => o.value === s)?.label }}</v-chip>
          <v-chip v-for="t in selectedTypes" :key="t" size="small" label class="mr-2 mb-2" color="info">
            {{ t }}
          </v-chip>
          <v-alert type="warning" variant="tonal" density="compact" class="mt-3" icon="mdi-alert">
            Cette action s'applique à <strong>tous</strong> les messages correspondants, pas seulement ceux affichés sur cette page.
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer/>
          <v-btn variant="text" @click="filterDialog = false">Annuler</v-btn>
          <v-btn color="error" variant="flat" :loading="replayingFilter" @click="doFilterReplay">
            Confirmer ({{ total }})
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog batch -->
    <v-dialog v-model="batchDialog" max-width="420">
      <v-card>
        <v-card-title class="text-h6">Rejouer la sélection</v-card-title>
        <v-card-text>
          Vous allez rejouer <strong>{{ selected.length }}</strong> message(s).
          Leur statut passera à <strong>A_TRAITER</strong>.
        </v-card-text>
        <v-card-actions>
          <v-spacer/>
          <v-btn variant="text" @click="batchDialog = false">Annuler</v-btn>
          <v-btn color="warning" variant="flat" :loading="replayingBatch" @click="doBatchReplay">
            Confirmer
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { fetchSummary, fetchMessages, fetchMessageTypes, replayBatch, replayByFilter } from '../services/api.js'
import AutoRefreshControl  from '../components/AutoRefreshControl.vue'
import StatusChip          from '../components/StatusChip.vue'
import MessageDetailDrawer from '../components/MessageDetailDrawer.vue'

const props = defineProps({
  initialStatus:    { type: String, default: null },
  initialType:      { type: String, default: null },
  initialDirection: { type: String, default: null },
})

// ── Constantes ────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'A_TRAITER',     label: 'À traiter',    color: 'info'    },
  { value: 'EN_TRAITEMENT', label: 'En traitement', color: 'warning' },
  { value: 'TRAITE',        label: 'Traité',        color: 'success' },
  { value: 'EN_ERREUR',     label: 'En erreur',     color: 'error'   },
]

// ── State ─────────────────────────────────────────────────────────────────────
const summary        = ref(null)
const loadingSummary = ref(false)
const tableExpanded  = ref(undefined)
const tableLoaded    = ref(false)

const messages          = ref([])
const total             = ref(0)
const page              = ref(0)
const pageSize          = ref(50)
const loading           = ref(false)
const selected          = ref([])
const selectedStatuses  = ref(props.initialStatus    ? [props.initialStatus]    : [])
const selectedDirection = ref(props.initialDirection ?? null)
const selectedTypes     = ref(props.initialType      ? [props.initialType]      : [])
const availableTypes    = ref([])
const appRole           = ref('both')

const drawerOpen      = ref(false)
const selectedMessage = ref(null)

const batchDialog    = ref(false)
const replayingBatch = ref(false)

const filterDialog    = ref(false)
const replayingFilter = ref(false)

const hasActiveFilter = computed(() =>
  selectedStatuses.value.length > 0 || (selectedTypes.value?.length ?? 0) > 0 || !!selectedDirection.value
)
const showDirFilter = computed(() =>
  summary.value === null || (summary.value.inbox != null && summary.value.outbox != null)
)

// ── Colonnes ──────────────────────────────────────────────────────────────────
const ALL_COLUMNS = [
  { title: 'ID',          key: 'id',          sortable: false },
  { title: 'Utilisateur', key: 'utilisateur', sortable: false },
  { title: 'Horodatage',  key: 'timestamp',   sortable: false },
  { title: 'Type',        key: 'type',        sortable: false },
  { title: 'Direction',   key: 'direction',   sortable: false },
  { title: 'Statut',      key: 'statut',      sortable: false },
  { title: 'Nb rejeux',   key: 'nbRejeux',    sortable: false, align: 'center' },
]

const LS_KEY = 'sema:visibleColumns'
const DEFAULT_COLUMNS = ALL_COLUMNS.map(c => c.key)

function loadVisibleKeys() {
  try {
    const stored = localStorage.getItem(LS_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return DEFAULT_COLUMNS
}

const visibleColumnKeys = ref(loadVisibleKeys())
watch(visibleColumnKeys, val => localStorage.setItem(LS_KEY, JSON.stringify(val)))

const headers = computed(() => ALL_COLUMNS.filter(c => visibleColumnKeys.value.includes(c.key)))

function toggleColumn(key) {
  const idx = visibleColumnKeys.value.indexOf(key)
  if (idx === -1) {
    const newKeys = [...visibleColumnKeys.value, key]
    visibleColumnKeys.value = ALL_COLUMNS.map(c => c.key).filter(k => newKeys.includes(k))
  } else {
    visibleColumnKeys.value = visibleColumnKeys.value.filter(k => k !== key)
  }
}

// ── Chargement du résumé ──────────────────────────────────────────────────────
async function loadSummary() {
  loadingSummary.value = true
  try {
    summary.value = await fetchSummary()
    appRole.value = summary.value.role
  } finally {
    loadingSummary.value = false
  }
}

// ── Ouverture du panneau → premier chargement de la liste ─────────────────────
watch(tableExpanded, async (val) => {
  if (val === 'messages' && !tableLoaded.value) {
    tableLoaded.value = true
    await load()
  }
})

// ── Sélection de direction ────────────────────────────────────────────────────
async function setDirection(value) {
  selectedDirection.value = value
  page.value = 0
  if (tableLoaded.value && tableExpanded.value === 'messages') await load()
}

// ── Changement de types (sidebar) ────────────────────────────────────────────
function onTypesChange() {
  page.value = 0
  if (tableExpanded.value === 'messages') load()
}

// ── Clic sur un compteur du résumé ────────────────────────────────────────────
async function filterFromSummary(direction, status) {
  selectedDirection.value = direction
  selectedStatuses.value  = [status]
  selectedTypes.value     = []
  page.value              = 0
  tableExpanded.value     = 'messages'
  if (tableLoaded.value) await load()
}

// ── Auto-refresh ──────────────────────────────────────────────────────────────
async function onAutoRefresh() {
  await loadSummary()
  if (tableExpanded.value === 'messages') await load()
}

// ── Filtres ───────────────────────────────────────────────────────────────────
function toggleStatus(value) {
  const idx = selectedStatuses.value.indexOf(value)
  if (idx === -1) selectedStatuses.value.push(value)
  else selectedStatuses.value.splice(idx, 1)
  page.value = 0
  if (tableExpanded.value === 'messages') load()
}

function resetFilters() {
  selectedDirection.value = null
  selectedStatuses.value  = []
  selectedTypes.value     = []
  page.value              = 0
  if (tableExpanded.value === 'messages') load()
}

// ── Actions liste ─────────────────────────────────────────────────────────────
async function load() {
  loading.value = true
  try {
    const result = await fetchMessages({
      statuses:  selectedStatuses.value,
      direction: selectedDirection.value,
      types:     selectedTypes.value,
      page:      page.value,
      pageSize:  pageSize.value,
    })
    messages.value = result.items
    total.value    = result.total
    selected.value = []
  } finally {
    loading.value = false
  }
}

function openDrawer(message) {
  selectedMessage.value = message
  drawerOpen.value = true
}

function onReplayed(updated) {
  const idx = messages.value.findIndex(m => m.id === updated.id)
  if (idx !== -1) messages.value[idx] = { ...messages.value[idx], ...updated }
}

async function doFilterReplay() {
  replayingFilter.value = true
  try {
    await replayByFilter({
      direction: selectedDirection.value,
      statuses:  selectedStatuses.value,
      types:     selectedTypes.value,
    })
    filterDialog.value = false
    page.value = 0
    await load()
  } finally {
    replayingFilter.value = false
  }
}

async function doBatchReplay() {
  replayingBatch.value = true
  try {
    const result = await replayBatch(selected.value)
    for (const updated of result.messages) {
      const idx = messages.value.findIndex(m => m.id === updated.id)
      if (idx !== -1) messages.value[idx] = { ...messages.value[idx], ...updated }
    }
    batchDialog.value = false
    selected.value    = []
  } finally {
    replayingBatch.value = false
  }
}

onMounted(async () => {
  await loadSummary()
  const meta = await fetchMessageTypes()
  availableTypes.value = meta.types
  if (props.initialStatus || props.initialType || props.initialDirection) {
    tableExpanded.value = 'messages'
  }
})
</script>
