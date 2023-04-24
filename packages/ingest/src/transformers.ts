import { Atom } from '@osuresearch/types';

export function toFacet(atom: Atom): string | undefined {
  if (!atom.type) {
    return undefined;
  }

  /*
    The open question: what do facets look like?
    - Need to be able to store them as a singular field.
    - Can't use nested fields (https://www.elastic.co/guide/en/elasticsearch/reference/current/nested.html#_limits_on_nested_mappings_and_objects)
    - Want to still be able to facet them as a full entity (keyword)
    - Want to be able to search within them for text
      (e.g. a person by email OR name)
    - Want to be able to perform highlight matches on them

    Let's try YAML!

    Why?
    - Very similar to the more advanced search syntax of key:value
    - Easy(ish) to deconstruct/reconstruct back into JSON (depending on what happens during highlighting...)
    - Not too difficult to sanitize values, as long as they don't have newlines we're good.
    - Type info is still baked in, since `type:Whatever` is always first.
    - May even support exact match searches like `email:mcmanning.1` for advanced use cases

    Now some data types, it may not make any sense to do this.
    Text, Email, Url, DateTime, probably not.
    But PEOPLE - yes all those fields need to be one entity, period.

    An email message? Maybe only some parts of it can be faceted on
    so we encode those, but not the entire recipient list and all that.
    (That's more a concrete Resource type we would manage)

    Another gotcha/concern is that we have a limit on keyword size
    in Elastic (~8000 is what I have it set to, 256 by default).

    Long text values, such as huge write-ins, should probably be
    also trimmed down as part of this conversion. We can maintain
    the full version for full text searching but the faceting would
    have to use a trimmed copy in some way.

    E.g. someone packs something into the Text field.

    Note that colons currently do not work due to a parsing issue
    in Searchkit 4. See: https://github.com/searchkit/searchkit/issues/1260
    Using tabs in the meantime
  */

  /*
    This format is yaml-like. True YAML would be nice but there's a SK4
    issue that needs to be resolved (https://github.com/searchkit/searchkit/issues/1260)

    Also this only supports one level of fields. Good for most
    common types (Person, DateTime, Text, etc) but not complex fields.
  */
  return Object.keys(atom).reduce((agg, name) => {
    const value = '' + atom[name as keyof typeof atom];
    agg += `${name}|${value.replace(/(\n|\t)/g, '')}\n`;
    return agg;
  }, '');
}

export function toSearchable(atom: Atom): string[] {
  if (!atom.type) {
    return [];
  }

  // Lazy version:
  // stringify all fields that can be stringified at a single level, omitting type.

  return Object.keys(atom).reduce<string[]>((agg, name) => {
    if (name === 'type') {
      return agg;
    }

    const value = '' + atom[name as keyof typeof atom];
    agg.push(value);
    return agg;
  }, []);
}

export function containsValidAtoms(atoms: any) {
  try {
    for (let atom of Object.values<Atom>(atoms)) {
      if (typeof atom.type !== 'string') {
        return false;
      }
    }
  }
  catch {
    return false;
  }

  return true;
}
