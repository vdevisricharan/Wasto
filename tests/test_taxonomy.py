"""
Unit tests for Wasto Taxonomy and Routing Engine.
Verifies operational routing, zero-false-biodegradability rules,
and uncertainty thresholding.
"""

import pytest
from shared.taxonomy import (
    MaterialClass,
    RoutingCategory,
    resolve_routing,
    DEFAULT_MATERIAL_ROUTING,
    CANONICAL_CLASSES,
)

def test_canonical_classes_count():
    assert len(CANONICAL_CLASSES) == 9
    assert MaterialClass.ORGANIC_WASTE.value in CANONICAL_CLASSES
    assert MaterialClass.GLASS.value in CANONICAL_CLASSES
    assert MaterialClass.ALUMINIUM.value in CANONICAL_CLASSES

def test_glass_and_metal_never_classified_as_organic():
    """
    Core bugfix test: Glass and Aluminium must route to Recyclable,
    NEVER to Organic/Biodegradable.
    """
    for mat in [MaterialClass.GLASS.value, MaterialClass.ALUMINIUM.value, MaterialClass.PLASTIC.value]:
        cat, uncertain, reason = resolve_routing(
            material_label=mat,
            confidence=0.92,
            scores={mat: 0.92, "Wood": 0.08},
        )
        assert cat == RoutingCategory.RECYCLABLE
        assert not uncertain
        assert cat != RoutingCategory.ORGANIC

def test_organic_waste_routes_to_organic():
    cat, uncertain, reason = resolve_routing(
        material_label=MaterialClass.ORGANIC_WASTE.value,
        confidence=0.88,
        scores={MaterialClass.ORGANIC_WASTE.value: 0.88, "Wood": 0.12},
    )
    assert cat == RoutingCategory.ORGANIC
    assert not uncertain
    assert reason is None

def test_residual_materials():
    for mat in [MaterialClass.TEXTILES.value, MaterialClass.WOOD.value, MaterialClass.OTHER_PLASTICS.value]:
        cat, uncertain, reason = resolve_routing(
            material_label=mat,
            confidence=0.85,
            scores={mat: 0.85, "Glass": 0.15},
        )
        assert cat == RoutingCategory.RESIDUAL
        assert not uncertain

def test_low_confidence_abstention():
    """Predictions below 0.60 must route to Unknown / Manual Review."""
    cat, uncertain, reason = resolve_routing(
        material_label=MaterialClass.PLASTIC.value,
        confidence=0.45,
        scores={MaterialClass.PLASTIC.value: 0.45, "Glass": 0.35},
        confidence_threshold=0.60,
    )
    assert cat == RoutingCategory.UNKNOWN
    assert uncertain is True
    assert "below threshold" in reason

def test_ambiguity_margin_abstention():
    """If top-1 and top-2 margin is below 0.15, must route to Unknown / Manual Review."""
    scores = {
        MaterialClass.PLASTIC.value: 0.62,
        MaterialClass.GLASS.value: 0.58,  # margin = 0.04 < 0.15
        MaterialClass.ALUMINIUM.value: 0.10,
    }
    cat, uncertain, reason = resolve_routing(
        material_label=MaterialClass.PLASTIC.value,
        confidence=0.62,
        scores=scores,
        confidence_threshold=0.60,
        ambiguity_margin=0.15,
    )
    assert cat == RoutingCategory.UNKNOWN
    assert uncertain is True
    assert "ambiguity" in reason.lower()

def test_unknown_label_abstention():
    cat, uncertain, reason = resolve_routing(
        material_label="UraniumFuelRod",
        confidence=0.99,
    )
    assert cat == RoutingCategory.UNKNOWN
    assert uncertain is True
    assert "Unrecognized" in reason
