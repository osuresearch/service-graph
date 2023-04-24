import { Atom } from '@osuresearch/types';
import { connect as OSConnect, disconnect as OSDisconnect, rebuild, bulk } from './opensearch';
import { connect as MSSQLConnect, disconnect as MSSQLDisconnect, batch } from './mssql';
import { Resource } from './types';
import { containsValidAtoms, toFacet, toSearchable } from './transformers';
import { updateObjectByJSONPath } from './utils';

/**
 * Utility to fully rebuild
 *
 * Assumes a specific format for columns.
 * Documentation... eventually.
 *
 * @param index
 * @param table
 */
export async function bulkRebuild(
  index: string,
  table: string
) {
  // Rebuild OpenSearch index from scratch.
  // This assumes no incremental updates
  await rebuild(index);

  // Pull down everything unfiltered.
  const query = `select * from ${table}`;

  return batchFromQuery(index, query);
}

/**
 * Utility to upsert one or more resources by ID into the given index.
 *
 * @param index
 * @param table
 * @param ids
 */
export async function bulkUpsert(
  index: string,
  table: string,
  ids: string[]
) {

}

async function batchFromQuery(index: string, query: string) {

  try {
    // Your typical ETL:
    //  read batches of rows from SQL
    //  transform them into Resources for indexing
    //  bulk index them into OpenSearch.
    await batch(query, async (rows) => {
      const resources = rows.map<Resource>((row) => {

        const {
          id,
          name,
          description,
          textDescription,
          categoryLvl1,
          categoryLvl2,
          categoryLvl3,
          categoryLvl4,
          createdDate,
          updatedDate,
          deletedDate
        } = row;

        const resource: Resource = {
          id,
          name,
          description,
          textDescription,

          categoryLvl1,
          categoryLvl2,
          categoryLvl3,
          categoryLvl4,

          createdDate,
          updatedDate,
          deletedDate,

          attributes: {},

          facets: {},
          facetNames: [],

          searchables: {},
          searchableNames: [],
        };

        // Extract attributes as JSON paths.
        Object.keys(row).forEach((key) => {
          if (key.startsWith('$')) {
            updateObjectByJSONPath(key, resource, row[key]);
          }
        });

        // Scrub invalid attributes.
        Object.keys(resource.attributes).forEach((name) => {
          if (!containsValidAtoms(resource.attributes[name])) {
            delete resource.attributes[name];
          }
        })

        // Convert attributes into facets and full text searchables
        Object.keys(resource.attributes).forEach((name) => {
          let searchables: string[] = [];
          let facets: string[] = [];

          // Transform each attribute value into a facet and a searchable
          resource.attributes[name]?.forEach((atom: Atom) => {
            searchables = [...searchables, ...toSearchable(atom)];

            const facet = toFacet(atom);
            if (facet) {
              facets = [...facets, facet];
            }
          });

          if (facets.length > 0) {
            resource.facets[name] = facets;
          }

          if (searchables.length > 0) {
            resource.searchables[name] = searchables;
          }
        });

        resource.facetNames = Object.keys(resource.facets);
        resource.searchableNames = Object.keys(resource.searchables);

        console.log(JSON.stringify(resource, undefined, 2));
        return resource;
      });

      await bulk(index, resources);
    });
  }
  catch (e) {
    console.log(e);
    console.error(e);
  }
  finally {
    console.log('disconnect services');
    OSDisconnect();
    MSSQLDisconnect();
  }
}
