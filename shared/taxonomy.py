"""
Wasto Canonical Taxonomy and Routing Policy Engine.
Version: 1.0.0

This module defines the 9 fine-grained vision material classes,
the operational recycling bins, and the deterministic routing policy
that maps classification probabilities to physical actuator chutes.
"""

from enum import Enum
from typing import Dict, Optional, Tuple, Any

class MaterialClass(str, Enum):
    ALUMINIUM = "Aluminium"
    CARTON = "Carton"
    GLASS = "Glass"
    ORGANIC_WASTE = "Organic Waste"
    OTHER_PLASTICS = "Other Plastics"
    PAPER_AND_CARDBOARD = "Paper and Cardboard"
    PLASTIC = "Plastic"
    TEXTILES = "Textiles"
    WOOD = "Wood"

class RoutingCategory(str, Enum):
    ORGANIC = "Organic"
    RECYCLABLE = "Recyclable"
    RESIDUAL = "Residual"
    UNKNOWN = "Unknown / Manual Review"

# Canonical ordered class names matching model.h5 output dimensionality
CANONICAL_CLASSES = [
    MaterialClass.ALUMINIUM.value,
    MaterialClass.CARTON.value,
    MaterialClass.GLASS.value,
    MaterialClass.ORGANIC_WASTE.value,
    MaterialClass.OTHER_PLASTICS.value,
    MaterialClass.PAPER_AND_CARDBOARD.value,
    MaterialClass.PLASTIC.value,
    MaterialClass.TEXTILES.value,
    MaterialClass.WOOD.value,
]

# Baseline deterministic material-to-bin policy
DEFAULT_MATERIAL_ROUTING: Dict[str, RoutingCategory] = {
    MaterialClass.ORGANIC_WASTE.value: RoutingCategory.ORGANIC,
    MaterialClass.ALUMINIUM.value: RoutingCategory.RECYCLABLE,
    MaterialClass.CARTON.value: RoutingCategory.RECYCLABLE,
    MaterialClass.GLASS.value: RoutingCategory.RECYCLABLE,
    MaterialClass.PAPER_AND_CARDBOARD.value: RoutingCategory.RECYCLABLE,
    MaterialClass.PLASTIC.value: RoutingCategory.RECYCLABLE,
    MaterialClass.OTHER_PLASTICS.value: RoutingCategory.RESIDUAL,
    MaterialClass.TEXTILES.value: RoutingCategory.RESIDUAL,
    MaterialClass.WOOD.value: RoutingCategory.RESIDUAL,
}

# Disposal Guidance per category
DISPOSAL_GUIDANCE: Dict[str, str] = {
    RoutingCategory.ORGANIC.value: (
        "Place into the compost bin. Biodegradable matter suitable for anaerobic digestion or municipal composting."
    ),
    RoutingCategory.RECYCLABLE.value: (
        "Rinse lightly and place in dry recyclables bin. Clean material destined for optical sorting and mechanical re-processing."
    ),
    RoutingCategory.RESIDUAL.value: (
        "Place in residual/general waste. Complex composite polymers or treated wood unsuitable for standard municipal recycling."
    ),
    RoutingCategory.UNKNOWN.value: (
        "Manual inspection required. Uncertain or mixed composition; hold for operator review to prevent recycling contamination."
    ),
}

DEFAULT_CONFIDENCE_THRESHOLD = 0.60
DEFAULT_AMBIGUITY_MARGIN = 0.15
ROUTING_POLICY_VERSION = "v1.0"

def resolve_routing(
    material_label: str,
    confidence: float,
    scores: Optional[Dict[str, float]] = None,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
    ambiguity_margin: float = DEFAULT_AMBIGUITY_MARGIN,
) -> Tuple[RoutingCategory, bool, Optional[str]]:
    """
    Deterministically resolves a material prediction into an operational routing bin.

    Returns:
        (routing_category, is_uncertain, uncertainty_reason)
    """
    # 1. Validation check for known material
    if material_label not in DEFAULT_MATERIAL_ROUTING:
        return (
            RoutingCategory.UNKNOWN,
            True,
            f"Unrecognized material class '{material_label}'",
        )

    # 2. Confidence threshold check
    if confidence < confidence_threshold:
        return (
            RoutingCategory.UNKNOWN,
            True,
            f"Confidence score {confidence:.3f} below threshold {confidence_threshold:.2f}",
        )

    # 3. Ambiguity margin check if full distribution provided
    if scores and len(scores) >= 2:
        sorted_scores = sorted(scores.values(), reverse=True)
        top1 = sorted_scores[0]
        top2 = sorted_scores[1]
        margin = top1 - top2
        if margin < ambiguity_margin:
            return (
                RoutingCategory.UNKNOWN,
                True,
                f"Top-2 margin ({margin:.3f}) below ambiguity threshold ({ambiguity_margin:.2f})",
            )

    # 4. Canonical Routing Resolution
    resolved = DEFAULT_MATERIAL_ROUTING[material_label]

    # 5. Strict safety invariant: Non-biodegradable items MUST NEVER route to Organic
    non_biodegradable_invariants = {
        MaterialClass.ALUMINIUM.value,
        MaterialClass.GLASS.value,
        MaterialClass.PLASTIC.value,
        MaterialClass.OTHER_PLASTICS.value,
    }
    if material_label in non_biodegradable_invariants and resolved == RoutingCategory.ORGANIC:
        # Failsafe protection against incorrect policy overrides
        return (
            RoutingCategory.UNKNOWN,
            True,
            f"Safety Invariant Violation: Non-biodegradable material '{material_label}' cannot route to Organic.",
        )

    return (resolved, False, None)
