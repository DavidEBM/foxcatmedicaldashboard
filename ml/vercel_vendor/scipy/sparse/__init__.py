"""Only the sparse type checks used by CatBoost's dense inference path."""


class spmatrix:
    """Compatibility base class; Vercel inference never creates sparse data."""


class dia_matrix(spmatrix):
    """Compatibility marker for CatBoost's sparse-type checks."""


class csr_matrix(spmatrix):
    pass


class csc_matrix(spmatrix):
    pass


class coo_matrix(spmatrix):
    pass


class lil_matrix(spmatrix):
    pass


class dok_matrix(spmatrix):
    pass


class bsr_matrix(spmatrix):
    pass


def issparse(value: object) -> bool:
    return isinstance(value, spmatrix)
