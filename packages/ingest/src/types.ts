import { BaseGraphQLServiceContext } from './shared';
import { AnyAtom } from '@osuresearch/types';

export type IngestServiceContext = BaseGraphQLServiceContext & {
  foo: string
}

export type ResourceTransformer<TData> = (data: TData) => Resource;
export type SQLRow = Record<string, any>;

export type SearchableMap = Record<string, string[]>;
export type FacetMap = Record<string, (string | number)[]>;
export type AttributeMap = Record<string, AnyAtom[]>;

/**
 * Hierarchical categorization of an entity
 */
export type Categorized = {
  categoryLvl1: string
  categoryLvl2?: string
  categoryLvl3?: string
  categoryLvl4?: string
}

/**
 * Data structure indexed into OpenSearch
 */
export type Resource = Categorized & {
  /** Unique IRI of this resource */
  id: string

  /** Human-readable name */
  name: string

  /** Human-readable description in `text/html` format */
  description: string

  /** Same as description but with stripped tags. Used for full text search. */
  textDescription: string

  createdDate?: string
  updatedDate?: string
  deletedDate?: string

  /**
   * Source atomic values. These are not
   * search indexed but are made available for
   * displaying within search results.
   */
  attributes: AttributeMap

  /**
   * List of available searchable attributes
   * within this resource
   */
  searchableNames: string[]

  /**
   * Transformed attributes that can be
   * full text searched against.
   */
  searchables: SearchableMap

  /**
   * List of available facet names for
   * this resource
   */
  facetNames: string[]

  /**
   * Transformed attributes that can be
   * presented as facets
   */
  facets: FacetMap
}
