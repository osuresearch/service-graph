
/**
 * Number of documents per OpenSearch bulk operation
 */
export const MAX_DOCUMENTS_PER_BATCH = 500;

export const OPENSEARCH_INDEX_SETTINGS = {
  index: {
    // Shard vs replica configuration is setup to be for a single node.
    // I won't add nodes until I see a need to scale us up.
    // See: https://opster.com/guides/elasticsearch/operations/elasticsearch-yellow-status/
    number_of_shards: 1,
    number_of_replicas: 0,
  },
  analysis: {
    filter: {
      english_stop: {
        type: 'stop',
        stopwords: '_english_',
      },
      // # 'research_synonym': {
      // #   'type': 'synonym',
      // #   # TODO: Upload a synonym file to OpenSearch on AWS
      // #   # Ref: https://aws.amazon.com/blogs/big-data/automate-amazon-es-synonym-file-updates/
      // #   # Ref: https://www.elastic.co/guide/en/elasticsearch/reference/current/analysis-synonym-tokenfilter.html#_solr_synonyms
      // #   'synonyms_path': 'analysis/research_synonyms.txt',
      // # }
    },
    analyzer: {
      default: {
        // Override the default analyzer with a custom config.
        // See Catalog issue #9
        tokenizer: 'whitespace', // Tokenize by whitespace only
        filter: [
          'lowercase', // Normalize case to match "FOX" with "fox"
          'english_stop', // Remove stopword tokens (e.g. "a", "an", "the", etc)
        ]
      }
    }
  }
};

const FACETED_TEXT = {
  type: 'text',
  fields: {
    keyword: {
      type: 'keyword'
    }
  }
};

// Note that mapping needs to be compatible with ElasticSearch 7.10
// (the version OpenSearch forked from)
export const OPENSEARCH_INDEX_MAPPINGS = {
  dynamic_templates: [
    {
      // Prevent default behaviour of creating a sub-keyword field under each attribute.
      // So we generate a mapping like "Contact": { "type": "text" } instead of
      // "Contact": { "type" : "text", "fields" : { "keyword" : { "type" : "keyword", ... }}
      // This allows us to do a mult_match query against the field as a wildcard without
      // worrying about conflict with keyword sub-fields.
      searchable_attributes: {
        path_match: 'searchables.*',
        mapping: {
          type: 'text',
        }
      }
    },
    {
      // Facets are treated as pure keywords
      faceted_attributes: {
        path_match: 'facets.*',
        mapping: {
          type: 'text',
          fields: {
            keyword: {
              type: 'keyword',
              // Raising keyword byte limit since we pack
              // YAML blocks as keywords.
              // See: https://www.elastic.co/guide/en/elasticsearch/reference/current/ignore-above.html
              ignore_above: 8191
            }
          }
          // type: 'keyword',

        }
      }
    },
    {
      // Any number of relationships can be defined on a per-index
      // basis (protocols, grants, collections, facilities, etc)
      // These are all grouped under the top level related field
      // and treated as keyword matching.
      related_resources: {
        path_match: 'related.*',
        mapping: {
          type: 'keyword',
        }
      }
    },
  ],
  properties: {
    id: FACETED_TEXT,
    name: FACETED_TEXT,

    // Hierarchical categorization across the enterprise
    categoryLvl1: FACETED_TEXT,
    categoryLvl2: FACETED_TEXT,
    categoryLvl3: FACETED_TEXT,
    categoryLvl4: FACETED_TEXT,

    // CRUD dates
    createdDate: {
      type: 'date',
    },
    updatedDate: {
      type: 'date',
    },
    deletedDate: {
      type: 'date',
    },

    // We don't index description due to HTML content but it's
    // included so we can inline formatted content on demand.
    description: {
      type: 'text',
      index: false,
    },

    // But we DO index a text-only version of the description
    textDescription: {
      type: 'text'
    },

    // Original attribute values. These aren't analyzed for
    // indexing but are included to support displaying the
    // untransformed values in the search results UI.
    attributes: {
      type: 'object',
    },

    // A subset of attributes simplified down to values
    // that we can perform full text searches against.
    searchables: {
      type: 'object',
    },

    // A listing of all searchable attribute keys.
    // This is equivalent to Object.keys(searchables)
    searchableNames: {
      type: 'keyword'
    },

    // A subset of attributes simplified down to values
    // that we can perform faceted filtering against.
    facets: {
      type: 'object',
    },

    // A listing of all facetable attribute keys.
    // This is equivalent to Object.keys(facets)
    facetNames: {
      type: 'keyword',
    },
  }
};
