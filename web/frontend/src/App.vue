<template>
  <n-config-provider
    :locale="naiveLocale"
    :date-locale="naiveDateLocale"
    :theme="naiveTheme"
    :theme-overrides="themeOverrides"
  >
    <n-notification-provider>
      <n-message-provider>
        <n-dialog-provider>
          <n-layout class="app-shell" has-sider>
            <n-layout-sider
              class="app-sidebar"
              :width="248"
              :collapsed-width="72"
              collapse-mode="width"
              :collapsed="collapsed"
              @update:collapsed="(v: boolean) => collapsed = v"
            >
              <button
                class="brand"
                :class="{ 'is-collapsed': collapsed }"
                type="button"
                :aria-label="collapsed ? t('app.expandSidebar') : 'TradingV'"
                @click="collapsed && (collapsed = false)"
              >
                <div class="brand-mark">
                  <img src="/favicon.svg" alt="TradingV" />
                </div>
                <div v-if="!collapsed" class="brand-copy">
                  <div class="brand-name">TradingV</div>
                  <div class="brand-subtitle">AI Trading Workspace</div>
                </div>
              </button>

              <div class="sidebar-section" :class="{ 'is-collapsed': collapsed }">
                <div v-if="!collapsed" class="sidebar-label">{{ t('app.workspace') }}</div>
                <n-menu
                  :collapsed="collapsed"
                  :collapsed-width="52"
                  :collapsed-icon-size="21"
                  :icon-size="18"
                  :options="menuOptions"
                  :value="currentKey"
                  @update:value="onMenuSelect"
                />
              </div>

              <div class="sidebar-footer" :class="{ 'is-collapsed': collapsed }">
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-button quaternary circle @click="collapsed = !collapsed">
                      <template #icon>
                        <n-icon>
                          <ChevronForwardOutline v-if="collapsed" />
                          <ChevronBackOutline v-else />
                        </n-icon>
                      </template>
                    </n-button>
                  </template>
                  {{ collapsed ? t('app.expandSidebar') : t('app.collapseSidebar') }}
                </n-tooltip>

                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-button quaternary class="locale-toggle" @click="toggleLocale">
                      {{ locale === 'zh-CN' ? 'EN' : '中' }}
                    </n-button>
                  </template>
                  {{ t('app.switchLanguage') }}
                </n-tooltip>

                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-button quaternary circle @click="toggleAppearance">
                      <template #icon>
                        <n-icon>
                          <SunnyOutline v-if="isDark" />
                          <MoonOutline v-else />
                        </n-icon>
                      </template>
                    </n-button>
                  </template>
                  {{ isDark ? t('app.lightMode') : t('app.darkMode') }}
                </n-tooltip>

                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-button quaternary circle @click="toggleThemeColor">
                      <template #icon>
                        <n-icon>
                          <ColorPaletteOutline />
                        </n-icon>
                      </template>
                    </n-button>
                  </template>
                  {{ isRedTheme ? t('app.themeRed') : t('app.themeGreen') }}
                </n-tooltip>
              </div>
            </n-layout-sider>

            <n-layout class="app-main">
              <n-layout-header class="topbar">
                <div class="topbar-left">
                  <n-button quaternary circle class="mobile-menu" @click="collapsed = !collapsed">
                    <template #icon>
                      <n-icon><AppsOutline /></n-icon>
                    </template>
                  </n-button>
                  <div class="topbar-copy">
                    <div class="topbar-kicker">{{ t('app.console') }}</div>
                    <div class="topbar-title">{{ currentTitle }}</div>
                  </div>
                </div>

                <div class="topbar-actions">
                  <n-button quaternary class="command-button" @click="router.push({ name: 'screener' })">
                    <template #icon>
                      <n-icon><CompassOutline /></n-icon>
                    </template>
                    <span>{{ t('menu.screener') }}</span>
                  </n-button>
                  <n-button type="primary" @click="router.push({ name: 'analyze' })">
                    <template #icon>
                      <n-icon><RocketOutline /></n-icon>
                    </template>
                    {{ t('menu.analyze') }}
                  </n-button>
                </div>
              </n-layout-header>

              <n-layout-content class="app-content">
                <main class="content-frame">
                  <router-view />
                </main>
              </n-layout-content>
            </n-layout>
          </n-layout>
        </n-dialog-provider>
      </n-message-provider>
    </n-notification-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed, h, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { darkTheme, NIcon } from 'naive-ui'
import {
  BarChartOutline,
  BriefcaseOutline,
  BulbOutline,
  CalendarNumberOutline,
  CardOutline,
  ChevronBackOutline,
  ChevronForwardOutline,
  CompassOutline,
  ConstructOutline,
  AppsOutline,
  ColorPaletteOutline,
  FileTrayFullOutline,
  MoonOutline,
  OptionsOutline,
  RocketOutline,
  ShieldCheckmarkOutline,
  SpeedometerOutline,
  SunnyOutline,
} from '@vicons/ionicons5'
import { naiveDateLocale, naiveLocale, setLocale } from './i18n'

const { t, locale } = useI18n()
const router = useRouter()
const route = useRoute()

const collapsed = ref(false)
const isRedTheme = ref(localStorage.getItem('themeColor') !== 'green')
const isDark = ref(localStorage.getItem('appearance') === 'dark')

const naiveTheme = computed(() => (isDark.value ? darkTheme : null))

watchEffect(() => {
  document.documentElement.dataset.theme = isDark.value ? 'dark' : 'light'
})

function toggleThemeColor() {
  isRedTheme.value = !isRedTheme.value
  localStorage.setItem('themeColor', isRedTheme.value ? 'red' : 'green')
}

function toggleAppearance() {
  isDark.value = !isDark.value
  localStorage.setItem('appearance', isDark.value ? 'dark' : 'light')
}

function toggleLocale() {
  setLocale(locale.value === 'zh-CN' ? 'en-US' : 'zh-CN')
}

const themeOverrides = computed(() => ({
  common: {
    borderRadius: '8px',
    borderRadiusSmall: '6px',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    primaryColor: isRedTheme.value ? '#f05365' : '#12a150',
    primaryColorHover: isRedTheme.value ? '#ff6b7c' : '#21b866',
    primaryColorPressed: isRedTheme.value ? '#cc314a' : '#087a39',
    primaryColorSuppl: isRedTheme.value ? '#ff6b7c' : '#21b866',
    infoColor: '#276ef1',
    successColor: '#12a150',
    warningColor: '#b7791f',
    errorColor: '#e5484d',
    textColor1: isDark.value ? '#f5f5f3' : '#171717',
    textColor2: isDark.value ? '#d6d3cc' : '#3f3f46',
    textColor3: isDark.value ? '#a8a29e' : '#71717a',
    bodyColor: isDark.value ? '#080807' : '#f7f6f2',
    cardColor: isDark.value ? '#121211' : '#ffffff',
    modalColor: isDark.value ? '#171716' : '#ffffff',
    borderColor: isDark.value ? 'rgba(255, 255, 255, 0.12)' : '#e7e5de',
    dividerColor: isDark.value ? 'rgba(255, 255, 255, 0.1)' : '#ece9df',
  },
  Card: {
    borderRadius: '8px',
    paddingMedium: '18px',
    paddingSmall: '14px',
    titleFontSizeMedium: '15px',
    titleFontWeight: '650',
  },
  Button: {
    borderRadiusMedium: '8px',
    borderRadiusLarge: '8px',
    heightMedium: '36px',
    heightLarge: '40px',
    fontWeight: '600',
  },
  Input: {
    borderRadius: '8px',
    heightMedium: '36px',
  },
  Select: {
    peers: {
      InternalSelection: {
        borderRadius: '8px',
        heightMedium: '36px',
      },
    },
  },
  DataTable: {
    thColor: isDark.value ? '#171716' : '#fbfaf7',
    thTextColor: isDark.value ? '#d6d3cc' : '#52525b',
    borderRadius: '8px',
  },
  Menu: {
    itemHeight: '38px',
    itemBorderRadius: '8px',
    itemTextColor: isDark.value ? '#d6d3cc' : '#52525b',
    itemTextColorActive: isDark.value ? '#ffffff' : '#171717',
    itemIconColorActive: isRedTheme.value ? '#f05365' : '#12a150',
    itemColorActive: isDark.value ? 'rgba(255,255,255,0.08)' : '#f1efe8',
    itemColorHover: isDark.value ? 'rgba(255,255,255,0.06)' : '#f6f4ed',
    itemColorActiveHover: isDark.value ? 'rgba(255,255,255,0.1)' : '#f1efe8',
  },
}))

const currentKey = computed(() => route.name as string)
const currentTitle = computed(() => {
  const match = menuOptions.value.find(item => item.key === currentKey.value)
  return match?.label || t('app.currentPage')
})

function renderIcon(icon: any) {
  return () => h(NIcon, null, { default: () => h(icon) })
}

const menuOptions = computed(() => [
  { label: t('menu.dashboard'), key: 'dashboard', icon: renderIcon(SpeedometerOutline) },
  { label: t('menu.analyze'), key: 'analyze', icon: renderIcon(BulbOutline) },
  { label: t('menu.screener'), key: 'screener', icon: renderIcon(OptionsOutline) },
  { label: t('menu.holdings'), key: 'holdings', icon: renderIcon(BriefcaseOutline) },
  { label: t('menu.schedule'), key: 'schedule', icon: renderIcon(CalendarNumberOutline) },
  { label: t('menu.paper'), key: 'paper', icon: renderIcon(CardOutline) },
  { label: t('menu.backtest'), key: 'backtest', icon: renderIcon(BarChartOutline) },
  { label: t('menu.quality'), key: 'quality', icon: renderIcon(ShieldCheckmarkOutline) },
  { label: t('menu.history'), key: 'history', icon: renderIcon(FileTrayFullOutline) },
  { label: t('menu.settings'), key: 'settings', icon: renderIcon(ConstructOutline) },
])

function onMenuSelect(key: string) {
  router.push({ name: key })
}
</script>
