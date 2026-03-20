import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import StatusChip from '../components/StatusChip.vue'

const vuetify = createVuetify()

function mountChip(status) {
  return mount(StatusChip, {
    props: { status },
    global: { plugins: [vuetify] },
  })
}

describe('StatusChip', () => {
  it.each([
    ['EN_ERREUR', 'En erreur'],
    ['EN_TRAITEMENT', 'En traitement'],
    ['A_TRAITER', 'À traiter'],
    ['TRAITE', 'Traité'],
  ])('renders label for status %s', (status, expectedLabel) => {
    const wrapper = mountChip(status)
    expect(wrapper.text()).toContain(expectedLabel)
  })

  it('falls back to raw status for unknown value', () => {
    const wrapper = mountChip('INCONNU')
    expect(wrapper.text()).toContain('INCONNU')
  })
})
