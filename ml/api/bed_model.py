"""Shared model contract. Importing this module does not import PyTorch."""

HORIZONS = (6, 12, 24, 48)
SEQUENCE_LENGTH = 24
HIDDEN_SIZE = 16
MODEL_CONTRACT = {
    "format_version": 1,
    "architecture": "lstm",
    "sequence_length": SEQUENCE_LENGTH,
    "hidden_size": HIDDEN_SIZE,
    "horizons_hours": list(HORIZONS),
    "normalization": "occupied_beds / capacity",
    "synthetic": True,
    "clinically_validated": False,
}


def build_model():
    import torch

    class BedLSTM(torch.nn.Module):
        def __init__(self):
            super().__init__()
            self.lstm = torch.nn.LSTM(1, HIDDEN_SIZE, batch_first=True)
            self.output = torch.nn.Linear(HIDDEN_SIZE, len(HORIZONS))

        def forward(self, values):
            sequence, _ = self.lstm(values)
            return torch.sigmoid(self.output(sequence[:, -1, :]))

    return BedLSTM()
