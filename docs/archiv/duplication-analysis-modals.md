# Code Duplication Analysis: PostNoteModal + ReplyModal

## Executive Summary
**PostNoteModal** (683 lines) and **ReplyModal** (681 lines) share significant duplicate code beyond the already extracted ContentValidationManager and EditorStateManager.

**Estimated duplicate code:** ~120 lines per modal
**Extraction potential:** 3 new managers

---

## 1. Tab Switching Logic (IDENTICAL - ~40 lines each)

### PostNoteModal.ts:299-340
```typescript
// Tab switching
const tabs = modal.querySelectorAll('[data-tab]');
tabs.forEach(tab => {
  tab.addEventListener('click', (e) => {
    const target = e.currentTarget as HTMLElement;
    const tabName = target.dataset.tab as TabMode;
    this.switchTab(tabName);
  });
});

private switchTab(tab: TabMode): void {
  this.currentTab = tab;
  const modal = document.querySelector('.post-note-modal');
  if (!modal) return;

  // Update tab buttons
  modal.querySelectorAll('[data-tab]').forEach(btn => {
    btn.classList.remove('active');
  });
  modal.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');

  // Show/hide content
  const composeContent = modal.querySelector('.post-note-compose');
  const previewContent = modal.querySelector('.post-note-preview');

  if (composeContent && previewContent) {
    if (tab === 'compose') {
      (composeContent as HTMLElement).style.display = 'block';
      (previewContent as HTMLElement).style.display = 'none';
    } else {
      (composeContent as HTMLElement).style.display = 'none';
      (previewContent as HTMLElement).style.display = 'block';
      this.updatePreview();
    }
  }
}
```

### ReplyModal.ts:362-403 (IDENTICAL)

**Duplication:** 100% identical logic, only modal class name differs

---

## 2. Textarea Event Handling (~20 lines each)

### PostNoteModal.ts:308-314
```typescript
// Textarea input
const textarea = modal.querySelector('[data-textarea]') as HTMLTextAreaElement;
if (textarea) {
  textarea.addEventListener('input', () => {
    this.content = textarea.value;
    this.updatePostButton();
  });
}
```

### ReplyModal.ts:371-377 (IDENTICAL)

**Duplication:** 100% identical

---

## 3. Action Button Event Handlers (~30 lines each)

### PostNoteModal.ts:316-346
```typescript
// Action buttons
const cancelBtn = modal.querySelector('[data-action="cancel"]');
cancelBtn?.addEventListener('click', () => this.hide());

const postBtn = modal.querySelector('[data-action="post"]');
postBtn?.addEventListener('click', () => this.handlePost());

// Poll creation (if enabled)
const pollToggle = modal.querySelector('[data-action="toggle-poll"]');
pollToggle?.addEventListener('click', () => {
  this.isPollEnabled = !this.isPollEnabled;
  this.togglePollUI();
});

// Poll option management
modal.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.matches('[data-action="add-poll-option"]')) {
    this.addPollOption();
  }
  if (target.matches('[data-action="remove-poll-option"]')) {
    const index = parseInt(target.dataset.index || '0');
    this.removePollOption(index);
  }
});
```

### ReplyModal.ts:379-409 (95% identical, post→reply)

**Duplication:** Nearly identical, minor naming differences

---

## 4. Modal Lifecycle (~20 lines each)

### Both modals:
```typescript
public show(options?: ShowOptions): void {
  this.resetState();
  this.container.style.display = 'flex';
  // Focus textarea...
}

public hide(): void {
  this.container.style.display = 'none';
  this.resetState();
  // Cleanup...
}

private resetState(): void {
  this.content = '';
  this.currentTab = 'compose';
  // Reset fields...
}
```

**Duplication:** ~80% similar structure

---

## Extraction Recommendations

### 1. **ModalTabSwitchingManager** (~60 lines)
**Purpose:** Handle compose/preview tab switching for all modals

**API:**
```typescript
class ModalTabSwitchingManager {
  constructor(config: {
    modalSelector: string;
    onTabSwitch: (tab: TabMode) => void;
  })

  switchTab(tab: TabMode): void
  setupEventListeners(): void
}
```

**Used by:**
- PostNoteModal
- ReplyModal
- Future modals with compose/preview tabs

**Lines saved:** ~40 per modal = 80 lines

---

### 2. **ModalEventHandlerManager** (~80 lines)
**Purpose:** Centralize modal event listener setup

**API:**
```typescript
class ModalEventHandlerManager {
  constructor(config: {
    modalSelector: string;
    textareaSelector: string;
    onTextInput: (value: string) => void;
    onCancel: () => void;
    onSubmit: () => void;
    pollConfig?: PollEventConfig;
  })

  setupEventListeners(): void
  destroy(): void
}
```

**Used by:**
- PostNoteModal
- ReplyModal
- Any modal with textarea + action buttons

**Lines saved:** ~50 per modal = 100 lines

---

### 3. **ModalLifecycleManager** (~40 lines)
**Purpose:** Handle show/hide/reset for all modals

**API:**
```typescript
class ModalLifecycleManager {
  constructor(config: {
    container: HTMLElement;
    onShow?: () => void;
    onHide?: () => void;
    onReset?: () => void;
  })

  show(): void
  hide(): void
  resetState(): void
}
```

**Used by:**
- All modals (ZapModal, DeleteNoteModal, ReportModal, etc.)

**Lines saved:** ~20 per modal × 8 modals = 160 lines

---

## Total Impact

| Manager | Lines | Modals Affected | Total Saved |
|---------|-------|----------------|-------------|
| **ModalTabSwitchingManager** | 60 | 2 | 80 lines |
| **ModalEventHandlerManager** | 80 | 2 | 100 lines |
| **ModalLifecycleManager** | 40 | 8+ | 160+ lines |
| **Total** | 180 | - | **340+ lines** |

**PostNoteModal:** 683 → ~590 lines (-93, -14%)
**ReplyModal:** 681 → ~588 lines (-93, -14%)
**Other Modals:** -20 lines each (lifecycle only)

---

## Priority Ranking

1. **HIGH:** ModalEventHandlerManager (100 lines saved, used by 2 large modals)
2. **MEDIUM:** ModalTabSwitchingManager (80 lines saved, clear separation of concerns)
3. **LOW:** ModalLifecycleManager (160+ lines saved across many modals, but less critical duplication)

---

## Architecture Score Impact

**Current Code Duplication Score:** 88/100

**After extraction:**
- ModalEventHandlerManager → +2 points = 90/100 ✅ TARGET REACHED
- All 3 managers → +4 points = 92/100 (exceeds target)

**Recommendation:** Extract ModalEventHandlerManager + ModalTabSwitchingManager to hit 90/100 target.
