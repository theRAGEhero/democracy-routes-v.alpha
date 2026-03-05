// ontology.js - lightweight OWL parser and UI hooks for Deliberation Ontology
(function () {
  const OWL_NS = 'http://www.w3.org/2002/07/owl#';
  const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
  const RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#';
  const DCT_NS = 'http://purl.org/dc/terms/';
  const SKOS_NS = 'http://www.w3.org/2004/02/skos/core#';

  const DESCRIPTION_FALLBACKS = {
    Argument: 'A reasoned contribution used to support or challenge positions within a deliberation.',
    ArgumentStructure: 'The internal scaffolding of an argument, including premises and conclusions.',
    Conclusion: 'The outcome that an argument is attempting to justify.',
    Consensus: 'A decision outcome where participants align on a shared agreement.',
    Contribution: 'Any meaningful input added by participants during the process.',
    CrossPlatformIdentifier: 'A reference that links deliberation entities across multiple systems.',
    DeliberationProcess: 'A structured route that guides participants from problem framing to outcomes.',
    Evidence: 'Supporting material that grounds arguments and positions.',
    FallacyType: 'A classification for reasoning errors encountered in arguments.',
    InformationResource: 'External knowledge sources or documents referenced in the workflow.',
    LegalSource: 'Normative materials—laws, regulations, rulings—relevant to the deliberation.',
    Organization: 'A formal group or institution engaged in or impacted by the process.',
    Participant: 'An individual or entity taking part in the workflow.',
    Position: 'A stance or viewpoint expressed within the deliberation.',
    Premise: 'A supporting claim that underpins an argument’s conclusion.',
    Role: 'The responsibility or function assigned to a participant.',
    Stage: 'A distinct step that structures how the deliberation unfolds over time.',
    Topic: 'The subject matter being explored or decided upon.'
  };

  const MODULE_CLASS_MAP = {
    discussion: ['DeliberationProcess', 'Stage', 'Topic', 'Argument', 'Contribution', 'InformationResource'],
    decision: ['Consensus', 'Conclusion', 'Argument', 'Position', 'DeliberationProcess'],
    participant: ['Participant', 'Role', 'Organization', 'Contribution'],
    ai_agents: ['InformationResource', 'Contribution', 'Argument', 'Stage'],
    gamification: ['Contribution', 'Stage', 'DeliberationProcess'],
    media: ['InformationResource', 'Contribution', 'Topic'],
    conflict_resolution: ['Consensus', 'Argument', 'Position', 'Stage'],
    custom: null
  };

  const state = {
    ready: false,
    error: null,
    classes: [],
    classIndex: {},
    objectProperties: [],
    dataProperties: [],
    metadata: {}
  };

  const listeners = [];

  function notify() {
    state.ready = true;
    while (listeners.length) {
      const cb = listeners.shift();
      try {
        cb(state);
      } catch (err) {
        console.error('Ontology listener error:', err);
      }
    }
  }

  function getDirectChildren(node, ns, localName) {
    const matches = [];
    node.childNodes.forEach((child) => {
      if (child.nodeType === 1 && child.namespaceURI === ns && child.localName === localName) {
        matches.push(child);
      }
    });
    return matches;
  }

  function getChildText(node, ns, localName) {
    const child = getDirectChildren(node, ns, localName)[0];
    return child ? child.textContent.trim() : '';
  }

  function getChildResource(node, ns, localName) {
    const child = getDirectChildren(node, ns, localName)[0];
    if (child) {
      const attr = child.getAttributeNS(RDF_NS, 'resource');
      if (attr) {
        return attr;
      }
    }
    return '';
  }

  function getChildrenResourceList(node, ns, localName) {
    return getDirectChildren(node, ns, localName)
      .map((child) => child.getAttributeNS(RDF_NS, 'resource'))
      .filter(Boolean);
  }

  function makeFragment(iri) {
    if (!iri) return '';
    const hashIndex = iri.lastIndexOf('#');
    if (hashIndex >= 0 && hashIndex < iri.length - 1) {
      return iri.slice(hashIndex + 1);
    }
    const slashIndex = iri.lastIndexOf('/');
    return slashIndex >= 0 ? iri.slice(slashIndex + 1) : iri;
  }

  function parseDocument(text) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) {
      const message = doc.getElementsByTagName('parsererror')[0].textContent;
      throw new Error(`Failed to parse ontology: ${message}`);
    }

    const ontologyEl = doc.getElementsByTagNameNS(OWL_NS, 'Ontology')[0];
    if (ontologyEl) {
      state.metadata = {
        iri: ontologyEl.getAttributeNS(RDF_NS, 'about') || '',
        label: getChildText(ontologyEl, RDFS_NS, 'label'),
        comment: getChildText(ontologyEl, RDFS_NS, 'comment'),
        version: getChildText(ontologyEl, OWL_NS, 'versionInfo'),
        created: getChildText(ontologyEl, DCT_NS, 'created'),
        modified: getChildText(ontologyEl, DCT_NS, 'modified'),
        license: getChildResource(ontologyEl, DCT_NS, 'license'),
        imports: getChildrenResourceList(ontologyEl, OWL_NS, 'imports')
      };
    }

    const classNodes = doc.getElementsByTagNameNS(OWL_NS, 'Class');
    state.classes = Array.from(classNodes).map((node) => {
      const iri = node.getAttributeNS(RDF_NS, 'about') || '';
      const fragment = makeFragment(iri);
      const label =
        getChildText(node, RDFS_NS, 'label') ||
        getChildText(node, SKOS_NS, 'prefLabel') ||
        fragment;
      const commentValue =
        getChildText(node, RDFS_NS, 'comment') ||
        getChildText(node, SKOS_NS, 'definition') ||
        '';
      const fallback = DESCRIPTION_FALLBACKS[fragment] || '';
      const comment = commentValue || fallback;
      const subClassOf = getChildrenResourceList(node, RDFS_NS, 'subClassOf');
      return { iri, fragment, label, comment, subClassOf };
    });
    state.classes.sort((a, b) => a.label.localeCompare(b.label));
    state.classIndex = state.classes.reduce((acc, cls) => {
      acc[cls.iri] = cls;
      acc[cls.fragment] = cls;
      return acc;
    }, {});

    const objectPropertyNodes = doc.getElementsByTagNameNS(OWL_NS, 'ObjectProperty');
    state.objectProperties = Array.from(objectPropertyNodes).map((node) => {
      const iri = node.getAttributeNS(RDF_NS, 'about') || '';
      return {
        iri,
        fragment: makeFragment(iri),
        label: getChildText(node, RDFS_NS, 'label') || makeFragment(iri),
        comment: getChildText(node, RDFS_NS, 'comment') || '',
        domain: getChildrenResourceList(node, RDFS_NS, 'domain'),
        range: getChildrenResourceList(node, RDFS_NS, 'range')
      };
    });

    const dataPropertyNodes = doc.getElementsByTagNameNS(OWL_NS, 'DatatypeProperty');
    state.dataProperties = Array.from(dataPropertyNodes).map((node) => {
      const iri = node.getAttributeNS(RDF_NS, 'about') || '';
      return {
        iri,
        fragment: makeFragment(iri),
        label: getChildText(node, RDFS_NS, 'label') || makeFragment(iri),
        comment: getChildText(node, RDFS_NS, 'comment') || '',
        domain: getChildrenResourceList(node, RDFS_NS, 'domain'),
        range: getChildrenResourceList(node, RDFS_NS, 'range')
      };
    });
  }

  function fetchOntology() {
    fetch('data/deliberation.owl')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Network response was not ok (${response.status})`);
        }
        return response.text();
      })
      .then((text) => {
        parseDocument(text);
        notify();
      })
      .catch((err) => {
        console.error('Unable to load ontology file:', err);
        state.error = err;
        notify();
      });
  }

  function onReady(callback) {
    if (state.ready) {
      callback(state);
    } else {
      listeners.push(callback);
    }
  }

  function getClassesForType(type) {
    if (!state.ready || !state.classes.length) {
      return [];
    }
    const config = MODULE_CLASS_MAP[type];
    if (!config || !config.length) {
      return state.classes.slice();
    }
    const picks = [];
    config.forEach((fragment) => {
      const cls = state.classIndex[fragment];
      if (cls && !picks.includes(cls)) {
        picks.push(cls);
      }
    });
    return picks;
  }

  function addIfExists(target, fragments) {
    fragments.forEach((fragment) => {
      const cls = state.classIndex[fragment];
      if (cls && !target.includes(cls)) {
        target.push(cls);
      }
    });
  }

  fetchOntology();

  window.ontologyStore = {
    onReady,
    getState: () => state,
    isReady: () => state.ready && !state.error,
    hasError: () => Boolean(state.error),
    getClasses: () => state.classes.slice(),
    getObjectProperties: () => state.objectProperties.slice(),
    getDataProperties: () => state.dataProperties.slice(),
    getClassesForType,
    getClassByIri: (iriOrFragment) => state.classIndex[iriOrFragment] || null,
    getMetadata: () => state.metadata
  };

  const cssEscape = (value) => {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }
    return String(value)
      .replace(/[^a-zA-Z0-9_\-]/g, '\\$&');
  };

  window.ontologyIntegration = {
    populateSelect(select) {
      if (!select) return;
      const type = select.dataset.ontologyType || '';
      const currentValue = select.value;
      const options = ontologyStore.isReady()
        ? ontologyStore.getClassesForType(type)
        : [];
      const defaultFragment = select.dataset.defaultFragment;
      const defaultIri = select.dataset.defaultIri;

      if (!options.length) {
        select.innerHTML = '<option value="">Loading ontology…</option>';
        select.disabled = true;
        return;
      }

      select.disabled = false;
      select.innerHTML = options
        .map((cls) => {
          const value = cls.iri || cls.fragment || '';
          const label = cls.label || cls.fragment || value || 'Unknown';
          const title = cls.comment ? cls.comment.replace(/"/g, '&quot;') : '';
          return `<option value="${value}" title="${title}">${label}</option>`;
        })
        .join('');

      if (currentValue && select.querySelector(`option[value="${cssEscape(currentValue)}"]`)) {
        select.value = currentValue;
      } else if (defaultIri && select.querySelector(`option[value="${cssEscape(defaultIri)}"]`)) {
        select.value = defaultIri;
      } else if (defaultFragment && select.querySelector(`option[value="${cssEscape(defaultFragment)}"]`)) {
        select.value = defaultFragment;
      } else if (options.length) {
        const fallbackValue = options[0].iri || options[0].fragment || '';
        if (fallbackValue) {
          select.value = fallbackValue;
        }
      }
    },

    updateDescription(select, descriptionEl) {
      if (!select || !descriptionEl) return;
      const selectedOption = select.selectedOptions && select.selectedOptions.length ? select.selectedOptions[0] : null;
      const meta =
        ontologyStore.getClassByIri(select.value) ||
        (selectedOption ? ontologyStore.getClassByIri(selectedOption.textContent) : null);
      if (meta && meta.comment) {
        descriptionEl.textContent = meta.comment;
      } else if (meta && meta.label) {
        descriptionEl.textContent = meta.label;
      } else {
        descriptionEl.textContent = '';
      }
    },

    bindEditor(editor) {
      if (!editor) return;

      const applyToNode = (nodeId) => {
        requestAnimationFrame(() => {
          const nodeEl = document.getElementById(`node-${nodeId}`);
          if (!nodeEl) return;
          const selects = nodeEl.querySelectorAll('.ontology-select');
          selects.forEach((select) => {
            this.populateSelect(select);
            const description = nodeEl.querySelector(`[data-ontology-description="${select.dataset.ontologyType}"]`);
            if (description) {
              this.updateDescription(select, description);
            }
            select.addEventListener('change', () => {
              if (description) {
                this.updateDescription(select, description);
              }
              const node = editor.getNodeFromId(nodeId);
              const nodeData = node && node.data ? node.data : {};
              editor.updateNodeDataFromId(nodeId, {
                ...nodeData,
                ontology: {
                  ...(nodeData.ontology || {}),
                  [select.dataset.ontologyType || 'default']: select.value
                }
              });
            });

            const node = editor.getNodeFromId(nodeId);
            const nodeData = node ? node.data : null;
            const ontologyData = nodeData && nodeData.ontology ? nodeData.ontology : null;
            const savedIri = ontologyData ? ontologyData[select.dataset.ontologyType || 'default'] : null;
            if (savedIri && select.querySelector(`option[value="${cssEscape(savedIri)}"]`)) {
              select.value = savedIri;
              if (description) {
                this.updateDescription(select, description);
              }
            }
          });
        });
      };

      editor.on('nodeCreated', applyToNode);

      ontologyStore.onReady((storeState) => {
        document.querySelectorAll('.ontology-select').forEach((select) => {
          this.populateSelect(select);
          const container = select.closest('.drawflow-node') || select.parentElement;
          const description = container
            ? container.querySelector(`[data-ontology-description="${select.dataset.ontologyType}"]`)
            : null;
          if (description) {
            this.updateDescription(select, description);
          }
        });

        const badge = document.querySelector('[data-ontology-status]');
        if (badge) {
          if (storeState.error) {
            badge.textContent = 'Ontology failed to load';
          } else {
            const versionInfo = storeState.metadata.version
              ? `v${storeState.metadata.version}`
              : 'loaded';
            const modified = storeState.metadata.modified
              ? ` • updated ${storeState.metadata.modified}`
              : '';
            badge.textContent = `${storeState.metadata.label || 'Deliberation Ontology'} ${versionInfo}${modified}`;
          }
        }

        this.populatePalette(storeState);
      });
    },

    populatePalette(storeState) {
      const panel = document.getElementById('ontology-palette');
      if (!panel) return;
      const list = panel.querySelector('[data-ontology-list]');
      if (!list) return;
      list.innerHTML = '';

      if (storeState.error) {
        list.innerHTML = '<p class="ontology-panel-empty">Failed to load ontology.</p>';
        return;
      }

      const classes = storeState.classes;
      if (!classes || classes.length === 0) {
        list.innerHTML = '<p class="ontology-panel-empty">No classes available.</p>';
        return;
      }

      const fragment = document.createDocumentFragment();
      classes.forEach((cls) => {
        const item = document.createElement('div');
        item.className = 'drag-drawflow ontology-item';
        item.setAttribute('draggable', 'true');
        item.setAttribute('data-node', 'ontology_class');
        item.setAttribute('data-ontology-iri', cls.iri);
        item.setAttribute('data-ontology-label', cls.label);
        item.innerHTML = `<i class="fas fa-book"></i><span>${cls.label}</span>`;
        item.title = cls.comment || cls.iri;
        fragment.appendChild(item);
      });

      list.appendChild(fragment);

      if (window.bindDrawflowDragElements) {
        window.bindDrawflowDragElements(panel);
      }

      const searchInput = document.getElementById('ontology-search');
      if (searchInput && !searchInput.dataset.bound) {
        searchInput.addEventListener('input', function () {
          const query = this.value.trim().toLowerCase();
          const items = list.querySelectorAll('.ontology-item');
          items.forEach((item) => {
            const text = item.textContent.toLowerCase();
            const title = (item.title || '').toLowerCase();
            const matches = text.includes(query) || title.includes(query);
            item.style.display = matches ? '' : 'none';
          });
        });
        searchInput.dataset.bound = 'true';
      }
    }
  };
})();
