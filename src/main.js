import EditorJS from '@editorjs/editorjs';
import Header from '@editorjs/header';
import mockData from './data/documents.json';

let selectedWorkspaceId = null;
let documentContents = mockData.documentContents || {};

document.addEventListener('DOMContentLoaded', async () => {
  let workspaces = [...mockData.workspaces]; 
  let currentWorkspace = workspaces[0];
  let currentDocument = null;
  let editor = null;

  function showModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('show');
    
    const inputs = modal.querySelectorAll('input');
    inputs.forEach(input => {
      input.value = '';
      
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          hideModal(modalId);
        }
      });
    });
    
    const handleEscKey = (e) => {
      if (e.key === 'Escape') {
        hideModal(modalId);
      }
    };
    
    document.addEventListener('keydown', handleEscKey);
    
    modal._escHandler = handleEscKey;
    
    const icons = modal.querySelectorAll('.icon-option');
    icons.forEach(icon => icon.classList.remove('selected'));

    const inputField = modal.querySelector('input[type="text"]');
    if (inputField) {
      inputField.focus();
    }
  }

  function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('show');
    
    if (modal._escHandler) {
      document.removeEventListener('keydown', modal._escHandler);
      delete modal._escHandler;
    }
  }

  editor = new EditorJS({
  holder: 'editorjs',
  placeholder: 'Type something...',
    onChange: () => {
      if (currentDocument) {
        statusIndicator.setState('unsaved');
      }

      updateEditorHeight();
    },
    tools: {
      header: {
        class: Header,
        inlineToolbar: true,
        config: {
          placeholder: 'Enter a header',
          levels: [1, 2, 3, 4, 5, 6],
          defaultLevel: 3
        }
      }
    }
  });

  await editor.isReady;
  console.log('Editor initialized');

  function renderWorkspaces() {
    const workspaceList = document.getElementById('workspace-list');
    workspaceList.innerHTML = workspaces.map(workspace => `
      <li class="workspace-item" data-workspace-id="${workspace.id}">
        <div class="workspace-header">
          <div class="workspace-title">
            <i class="${workspace.icon || 'fas fa-folder'}"></i>
            <span class="workspace-name">${workspace.name}</span>
          </div>
          <div class="workspace-actions">
            <button class="add-document-button" title="Add new document">
              <i class="fas fa-plus"></i>
            </button>
            <button class="three-dots-menu" title="More options">
              <i class="fas fa-ellipsis-v"></i>
              <div class="dropdown-menu">
                <div class="dropdown-item workspace-rename">
                  <i class="fas fa-edit"></i>
                  Rename
                </div>
                <div class="dropdown-item workspace-delete">
                  <i class="fas fa-trash"></i>
                  Delete
                </div>
              </div>
            </button>
          </div>
        </div>
        <ul class="document-list">
          ${workspace.documents.map(doc => `
            <li class="document-item" data-doc-id="${doc.id}">
              <i class="far fa-file-alt"></i>
              <span class="document-name">${doc.title}</span>
              <button class="three-dots-menu" title="More options">
                <i class="fas fa-ellipsis-v"></i>
                <div class="dropdown-menu">
                  <div class="dropdown-item document-rename">
                    <i class="fas fa-edit"></i>
                    Rename
                  </div>
                  <div class="dropdown-item document-delete">
                    <i class="fas fa-trash"></i>
                    Delete
                  </div>
                </div>
              </button>
            </li>
          `).join('')}
        </ul>
      </li>
    `).join('');

    attachDocumentHandlers();
    attachAddDocumentHandlers();
    attachWorkspaceHandlers();
    attachMenuHandlers();
  }

  function attachDocumentHandlers() {
    const documentItems = document.querySelectorAll('.document-item');
    console.log('Found document items:', documentItems.length);

    documentItems.forEach(item => {
      item.addEventListener('click', async (e) => {
        if (e.target.classList.contains('document-name') && e.target.contentEditable === 'true') {
          return;
        }
        
        console.log('Document clicked:', item.dataset.docId);
        await handleDocumentOpen(item);
      });

      item.querySelector('.document-name').addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const nameElement = e.target;
        nameElement.contentEditable = true;
        nameElement.focus();
        
        const range = document.createRange();
        range.selectNodeContents(nameElement);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      });

      const nameElement = item.querySelector('.document-name');
      nameElement.addEventListener('blur', () => {
        nameElement.contentEditable = false;
        handleDocumentNameEdit(nameElement);
      });
      nameElement.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          nameElement.blur();
        }
      });
    });
  }

  async function handleDocumentOpen(documentItem) {
    try {
      if (!documentItem) {
        console.error('No document item provided');
        return;
      }

      const docId = documentItem.dataset.docId;
      console.log('Opening document with ID:', docId);

      let foundDocument = null;
      for (let workspace of workspaces) {
        const document = workspace.documents.find(d => d.id === docId);
        if (document) {
          foundDocument = document;
          break;
        }
      }

      if (!foundDocument) {
        console.error('Document not found:', docId);
        return;
      }

      if (currentDocument) {
        const saveResult = await saveDocument();
        if (!saveResult) {
          const confirmSwitch = confirm('Failed to save current document. Switch anyway?');
          if (!confirmSwitch) {
            return;
          }
        }
      }

      currentDocument = foundDocument;
      console.log('Current document set to:', currentDocument);

      const titleElement = document.querySelector('.document-title');
      titleElement.textContent = currentDocument.title;

      await editor.clear();
      
      const content = documentContents[docId];
      if (content && Object.keys(content).length > 0) {
        console.log('Loading document content:', content);
        await editor.render(content);
      } else {
        documentContents[docId] = {
          time: Date.now(),
          blocks: []
        };
      }
      
      statusIndicator.setState('saved');

      document.querySelectorAll('.document-item').forEach(item => {
        item.classList.remove('active');
      });
      documentItem.classList.add('active');

    } catch (error) {
      console.error('Error opening document:', error);
      statusIndicator.setState('unsaved');
    }
  }

  function handleDocumentNameEdit(element) {
    const docId = element.closest('.document-item').dataset.docId;
    const newTitle = element.textContent.trim();
    
    for (let workspace of workspaces) {
      const doc = workspace.documents.find(d => d.id === docId);
      if (doc) {
        doc.title = newTitle;
        if (currentDocument && currentDocument.id === docId) {
          document.querySelector('.document-title').textContent = newTitle;
        }
        break;
      }
    }
  }

  const documentTitle = document.querySelector('.document-title');
  documentTitle.contentEditable = true;
  documentTitle.addEventListener('blur', () => {
    if (currentDocument) {
      const newTitle = documentTitle.textContent.trim();
      currentDocument.title = newTitle;
      const sidebarTitle = document.querySelector(`[data-doc-id="${currentDocument.id}"] .document-name`);
      if (sidebarTitle) {
        sidebarTitle.textContent = newTitle;
      }
    }
  });
  documentTitle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      documentTitle.blur();
    }
  });

  let autoSaveTimeout = null;
  const AUTO_SAVE_DELAY = 3000; 
  const statusIndicator = {
    element: document.querySelector('.status-indicator'),
    setState(state) {
      const states = {
        saved: {
          icon: 'fa-check-circle',
          text: 'All changes saved',
          color: '#16a34a'
        },
        saving: {
          icon: 'fa-spinner fa-spin',
          text: 'Saving...',
          color: '#2563eb'
        },
        unsaved: {
          icon: 'fa-circle',
          text: 'Unsaved changes',
          color: '#dc2626'
        }
      };

      const currentState = states[state];
      if (!currentState) return;

      this.element.innerHTML = `
        <i class="fas ${currentState.icon}" style="color: ${currentState.color}"></i>
        <span>${currentState.text}</span>
      `;
    }
  };

  const saveDocument = async () => {
    if (!currentDocument) return;
    
    statusIndicator.setState('saving');
    
    try {
      const data = await editor.save();
      documentContents[currentDocument.id] = data;
      
      currentDocument.lastModified = Date.now();
      
      setTimeout(() => {
        statusIndicator.setState('saved');
      }, 800);

      return true; 
    } catch (error) {
      console.error('Saving failed:', error);
      statusIndicator.setState('unsaved');
      return false; 
    }
  };

  statusIndicator.setState('saved');

  document.querySelector("#save").addEventListener("click", saveDocument);

  function attachIconHandlers() {
    document.querySelectorAll('.icon-option').forEach(icon => {
      icon.addEventListener('click', () => {
        document.querySelectorAll('.icon-option').forEach(i => i.classList.remove('selected'));
        icon.classList.add('selected');
      });
    });
  }

  function attachAddDocumentHandlers() {
    document.querySelectorAll('.add-document-button').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const workspaceItem = e.target.closest('.workspace-item');
        selectedWorkspaceId = workspaceItem.dataset.workspaceId;
        showModal('document-modal');
        document.getElementById('document-name').focus();
      });
    });
  }

  document.getElementById('add-workspace').addEventListener('click', () => {
    showModal('workspace-modal');
    attachIconHandlers();
  });

  document.querySelectorAll('.close-modal, .cancel-modal').forEach(button => {
    button.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      hideModal(modal.id);
    });
  });

  document.querySelector('.create-workspace').addEventListener('click', () => {
    handleModalSubmit('workspace-modal');
  });

  document.querySelector('.create-document').addEventListener('click', () => {
    handleModalSubmit('document-modal');
  });

  function attachWorkspaceHandlers() {
    document.querySelectorAll('.workspace-name').forEach(nameElement => {

      nameElement.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        nameElement.contentEditable = true;
        nameElement.focus();
        
        const range = document.createRange();
        range.selectNodeContents(nameElement);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      });

      nameElement.addEventListener('blur', () => {
        handleWorkspaceRename(nameElement);
      });

      nameElement.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          nameElement.blur();
        }
      });
    });
  }

  function handleWorkspaceRename(element) {
    element.contentEditable = false;
    const newName = element.textContent.trim();
    const workspaceId = element.closest('.workspace-item').dataset.workspaceId;
    
    if (!newName) {
      const workspace = workspaces.find(w => w.id === workspaceId);
      if (workspace) {
        element.textContent = workspace.name;
      }
      return;
    }

    const workspace = workspaces.find(w => w.id === workspaceId);
    if (workspace) {
      workspace.name = newName;
    }
  }

  function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
      menu.classList.remove('show');
    });
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.three-dots-menu')) {
      closeAllDropdowns();
    }
  });

  function attachMenuHandlers() {
    document.querySelectorAll('.three-dots-menu').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllDropdowns();
        const dropdown = button.querySelector('.dropdown-menu');
        dropdown.classList.add('show');
      });
    });

    document.querySelectorAll('.workspace-item').forEach(workspaceItem => {
      const workspaceId = workspaceItem.dataset.workspaceId;
      
      const renameButton = workspaceItem.querySelector('.workspace-rename');
      if (renameButton) {
        renameButton.addEventListener('click', (e) => {
          e.stopPropagation();
          const nameElement = workspaceItem.querySelector('.workspace-name');
          nameElement.contentEditable = true;
          nameElement.focus();
          closeAllDropdowns();
          
          const range = document.createRange();
          range.selectNodeContents(nameElement);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        });
      }

      const deleteButton = workspaceItem.querySelector('.workspace-delete');
      if (deleteButton) {
        deleteButton.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm('Are you sure you want to delete this workspace and all its documents?')) {
            const index = workspaces.findIndex(w => w.id === workspaceId);
            if (index !== -1) {
              const workspaceToDelete = workspaces[index];
              if (currentDocument && workspaceToDelete.documents.some(doc => doc.id === currentDocument.id)) {
                currentDocument = null;
                editor.clear();
                document.querySelector('.document-title').textContent = '';
              }

               workspaces.splice(index, 1);
              renderWorkspaces();
            }
          }
          closeAllDropdowns();
        });
      }
    });

     document.querySelectorAll('.document-item').forEach(documentItem => {
      const docId = documentItem.dataset.docId;
      
       const renameButton = documentItem.querySelector('.document-rename');
      if (renameButton) {
        renameButton.addEventListener('click', (e) => {
          e.stopPropagation();
          const nameElement = documentItem.querySelector('.document-name');
          nameElement.contentEditable = true;
          nameElement.focus();
          closeAllDropdowns();
          
          const range = document.createRange();
          range.selectNodeContents(nameElement);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        });
      }

      const deleteButton = documentItem.querySelector('.document-delete');
      if (deleteButton) {
        deleteButton.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm('Are you sure you want to delete this document?')) {
            handleDocumentDelete(docId);
          }
          closeAllDropdowns();
        });
      }
    });
  }

 function handleDocumentDelete(docId) {
    for (let workspace of workspaces) {
      const index = workspace.documents.findIndex(d => d.id === docId);
      if (index !== -1) {
        workspace.documents.splice(index, 1);
        delete documentContents[docId];
        renderWorkspaces();
        
        if (currentDocument && currentDocument.id === docId) {
          currentDocument = null;
          editor.clear();
          document.querySelector('.document-title').textContent = '';
        }
        
        if (workspace.documents.length > 0) {
          const firstDoc = document.querySelector('.document-item');
          if (firstDoc) {
            handleDocumentOpen(firstDoc);
          }
        }
        break;
      }
    }
  }

  renderWorkspaces();

  const firstDocumentItem = document.querySelector('.document-item');
  if (firstDocumentItem) {
    console.log('Opening first document by default');
    await handleDocumentOpen(firstDocumentItem);
  }

   function updateEditorHeight() {
    const editorElement = document.getElementById('editorjs');
    const content = editorElement.querySelector('.codex-editor__redactor');
    
    if (content) {
      const contentHeight = content.scrollHeight;
      const minHeight = 297 * 3.779528; // Convert 297mm to pixels (1mm = 3.779528px)
      editorElement.style.height = Math.max(contentHeight + 40, minHeight) + 'px';
    }
  }

  const editorContainer = document.getElementById('editorjs');
  const observer = new MutationObserver(() => {
    updateEditorHeight();
  });

  observer.observe(editorContainer, {
    childList: true,
    subtree: true,
    characterData: true
  });

  function handleModalSubmit(modalId) {
    if (modalId === 'workspace-modal') {
      const nameInput = document.getElementById('workspace-name');
      const selectedIcon = document.querySelector('.icon-option.selected');
      
      if (!nameInput.value.trim()) {
        alert('Please enter a workspace name');
        return;
      }
      
      if (!selectedIcon) {
        alert('Please select an icon');
        return;
      }

      const newWorkspace = {
        id: generateId(),
        name: nameInput.value.trim(),
        icon: selectedIcon.dataset.icon,
        documents: []
      };

      workspaces.push(newWorkspace);
      renderWorkspaces();
      hideModal('workspace-modal');
    } else if (modalId === 'document-modal') {
      const nameInput = document.getElementById('document-name');
      
      if (!nameInput.value.trim()) {
        alert('Please enter a document name');
        return;
      }

      if (!selectedWorkspaceId) {
        alert('No workspace selected');
        return;
      }

      const workspace = workspaces.find(w => w.id === selectedWorkspaceId);
      if (!workspace) {
        alert('Workspace not found');
        return;
      }

      const newDocument = {
        id: generateId(),
        title: nameInput.value.trim(),
        lastModified: Date.now()
      };

      documentContents[newDocument.id] = {
        time: Date.now(),
        blocks: []
      };

      workspace.documents.push(newDocument);
      renderWorkspaces();
      hideModal('document-modal');

       const documentItem = document.querySelector(`[data-doc-id="${newDocument.id}"]`);
      if (documentItem) {
        handleDocumentOpen(documentItem);
      }
    }
  }

  function attachModalKeyboardHandlers() {
    const workspaceNameInput = document.getElementById('workspace-name');
    workspaceNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleModalSubmit('workspace-modal');
      }
    });

    const documentNameInput = document.getElementById('document-name');
    documentNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleModalSubmit('document-modal');
      }
    });
  }

  attachModalKeyboardHandlers();
});

function generateId() {
  return 'id-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}
