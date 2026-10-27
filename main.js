/**
 * 官网静态交互。
 * 只处理导航、预览切换、复制反馈和滚动显现，不依赖后端或第三方脚本。
 */
const header = document.querySelector('[data-header]')
const menuToggle = document.querySelector('[data-menu-toggle]')
const navigation = document.querySelector('[data-navigation]')
const viewTabs = [...document.querySelectorAll('[data-view-tab]')]
const viewPanels = [...document.querySelectorAll('[data-view-panel]')]
const copyButtons = [...document.querySelectorAll('[data-copy-target]')]
const revealElements = [...document.querySelectorAll('[data-reveal]')]

/** 关闭移动导航并同步无障碍状态。 */
function closeMenu() {
  if (!menuToggle || !navigation) {
    return
  }
  menuToggle.setAttribute('aria-expanded', 'false')
  navigation.classList.remove('is-open')
  document.body.classList.remove('menu-open')
}

if (menuToggle && navigation) {
  menuToggle.addEventListener('click', () => {
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true'
    menuToggle.setAttribute('aria-expanded', String(!expanded))
    navigation.classList.toggle('is-open', !expanded)
    document.body.classList.toggle('menu-open', !expanded)
  })

  navigation.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('a')) {
      closeMenu()
    }
  })

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) {
      closeMenu()
    }
  })
}

if (header) {
  const syncHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 12)
  syncHeader()
  window.addEventListener('scroll', syncHeader, { passive: true })
}

/** 在 CLI 与 Web 预览之间切换，保持 ARIA 状态与可见面板一致。 */
function selectView(viewName) {
  for (const tab of viewTabs) {
    const active = tab.getAttribute('data-view-tab') === viewName
    tab.classList.toggle('is-active', active)
    tab.setAttribute('aria-selected', String(active))
  }
  for (const panel of viewPanels) {
    const active = panel.getAttribute('data-view-panel') === viewName
    panel.classList.toggle('is-active', active)
    panel.hidden = !active
  }
}

for (const tab of viewTabs) {
  tab.addEventListener('click', () => {
    selectView(tab.getAttribute('data-view-tab') ?? 'cli')
  })
  tab.addEventListener('keydown', (event) => {
    if (!(event instanceof KeyboardEvent) || !['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      return
    }
    event.preventDefault()
    const currentIndex = viewTabs.indexOf(tab)
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const nextIndex = (currentIndex + direction + viewTabs.length) % viewTabs.length
    const nextTab = viewTabs[nextIndex]
    if (nextTab) {
      nextTab.focus()
      selectView(nextTab.getAttribute('data-view-tab') ?? 'cli')
    }
  })
}

for (const button of copyButtons) {
  button.addEventListener('click', async () => {
    const targetId = button.getAttribute('data-copy-target')
    const target = targetId ? document.getElementById(targetId) : null
    if (!target) {
      return
    }

    const originalLabel = button.textContent
    try {
      await navigator.clipboard.writeText(target.textContent?.trim() ?? '')
      button.textContent = '已复制'
    } catch {
      button.textContent = '复制失败'
    }
    window.setTimeout(() => {
      button.textContent = originalLabel
    }, 1600)
  })
}

if (
  'IntersectionObserver' in window &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches
) {
  document.documentElement.classList.add('motion-ready')
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  )
  for (const element of revealElements) {
    observer.observe(element)
  }
} else {
  for (const element of revealElements) {
    element.classList.add('is-visible')
  }
}

const currentYear = document.querySelector('[data-current-year]')
if (currentYear) {
  currentYear.textContent = String(new Date().getFullYear())
}
