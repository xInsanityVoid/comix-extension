package eu.kanade.tachiyomi.source.model

class FilterList(vararg filters: Filter<*>) : List<Filter<*>> by filters.asList()
