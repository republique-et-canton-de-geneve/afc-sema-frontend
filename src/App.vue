<template>
  <v-app>
    <v-app-bar color="navbar" elevation="0">
      <template #prepend>
        <img src="/logo.svg" height="48" alt="République et canton de Genève" class="ml-2 mr-1"/>
      </template>
      <v-app-bar-title>
        <router-link to="/" class="text-white text-decoration-none font-weight-bold">
          SEMA
        </router-link>
        <span class="text-caption ml-2 opacity-70">Suivi et Exploitation des Messages Applicatifs</span>
      </v-app-bar-title>
      <template v-if="isMock" #append>
        <v-chip size="small" color="warning" variant="tonal" class="mr-4">
          <v-icon start icon="mdi-circle" size="x-small"/>
          MSW actif
        </v-chip>
      </template>
    </v-app-bar>

    <v-main>
      <router-view/>
    </v-main>
  </v-app>
</template>

<script setup>
const isMock = import.meta.env.VITE_MOCK === 'true'
</script>
